# Problem 6 — Live Scoreboard Module Specification

## Table of Contents

1. [Overview](#overview)
2. [Assumptions](#assumptions)
3. [System Architecture](#system-architecture)
4. [Data Models](#data-models)
5. [API Specification](#api-specification)
6. [Execution Flows](#execution-flows)
7. [Race Condition Prevention](#race-condition-prevention)
8. [Real-time Scoreboard (SSE)](#real-time-scoreboard-sse)
9. [Security Measures](#security-measures)
10. [Scalability](#scalability)
11. [Improvement Suggestions](#improvement-suggestions)

---

## Overview

This module handles **score updates** and **live scoreboard broadcasting** for a website that displays the top 10 users by score.

**Core responsibilities:**
- Accept authenticated score update requests after a user completes an action
- Validate the submission asynchronously via a worker pipeline
- Maintain a real-time leaderboard and push updates to all connected clients
- Prevent unauthorized or duplicate score manipulation

---

## Assumptions

> These assumptions are declared due to ambiguity in the original requirements.

| # | Assumption |
|---|---|
| A1 | `action_id` is an **instance ID** (a UUID identifying one specific completion event), not a type ID. This means each `action_id` can only be claimed once per user. The server is responsible for generating `action_id` before the client starts the action. |
| A2 | Each action has a fixed `score_value` stored server-side. Clients cannot influence the score delta. |
| A3 | The system is designed for **multi-instance deployment** (horizontally scaled API servers and workers). |
| A4 | "Completing an action" and "submitting the score update" are two separate events. The client calls the score update API only after the action is finished on the client side. |
| A5 | Score is strictly additive (never decreases). |
| A6 | A `proof` is an opaque string (e.g., HMAC or signed token) that the server can verify to confirm the action was legitimately completed. |

---

## System Architecture

> **Diagram:** The high-level architecture diagram is available in [`diagram.drawio`](./diagram.drawio) (open with [draw.io desktop](https://github.com/jgraph/drawio-desktop) or [app.diagrams.net](https://app.diagrams.net)).
> View online: [Google Drive](https://drive.google.com/file/d/1tfchL8tXYUcWyTkwFyecCqTOte36rSA7/view?usp=sharing)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT                                      │
│  - Fetch initial top 10 (REST)                                          │
│  - Subscribe to live updates (SSE)                                      │
│  - POST score update on action completion                               │
└───────────┬──────────────────────────────────┬──────────────────────────┘
            │ HTTP                             │ SSE
            ▼                                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    API SERVER (multi-instance)                         │
│                                                                        │
│  ┌──────────────────────┐     ┌──────────────────────────────────┐    │
│  │   Auth Middleware    │     │         SSE Manager              │    │
│  │   (JWT validation)   │     │  (in-memory client connections)  │    │
│  └──────────────────────┘     └──────────────┬───────────────────┘    │
│  ┌──────────────────────┐                    │ subscribe               │
│  │    Rate Limiter      │                    ▼                         │
│  │ (per user, per IP)   │     ┌──────────────────────────────────┐    │
│  └──────────────────────┘     │         Redis Pub/Sub            │    │
│  ┌──────────────────────┐     │   channel: "leaderboard:top10"   │    │
│  │  Submission Handler  │     └──────────────────────────────────┘    │
│  │  - Save to DB        │                    ▲ publish                 │
│  │  - Publish to Kafka  │                    │                         │
│  └──────────────────────┘                    │                         │
└─────────────────┬────────────────────────────┼─────────────────────────┘
                  │ produce                     │
                  ▼                             │
┌─────────────────────────────┐                │
│           KAFKA             │                │
│  topic: action-submissions  │                │
│  partition key: user_id     │                │
└──────────┬──────────────────┘                │
           │ consume                           │
           ▼                                   │
┌─────────────────────────────────────────────────────────────────────┐
│                   VALIDATION WORKER (consumer group)                 │
│                                                                      │
│  1. Acquire Redlock(user_id + action_id)                            │
│  2. Check idempotency (DB unique constraint)                        │
│  3. Verify proof                                                    │
│  4. Fetch score_value from actions table                            │
│  5. Atomic UPDATE users score                                       │
│  6. Optimistic lock check (version)                                 │
│  7. Update Redis Sorted Set (leaderboard)                           │
│  8. If top 10 changed → publish to Redis Pub/Sub                   │
│  9. Mark submission as VALID                                        │
│  10. Release Redlock                                                │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                ┌──────────────────┴──────────────────┐
                ▼                                      ▼
┌──────────────────────────┐         ┌───────────────────────────────┐
│       PostgreSQL          │         │             Redis              │
│                           │         │                               │
│  - users                  │         │  Sorted Set: leaderboard      │
│  - actions                │         │    ZADD leaderboard           │
│  - submissions            │         │      <score> <user_id>        │
│                           │         │    ZREVRANGE 0 9 → top 10     │
│                           │         │                               │
│                           │         │  Pub/Sub: leaderboard:top10   │
│                           │         │  Redlock: distributed locks   │
└───────────────────────────┘         └───────────────────────────────┘
```

---

## Data Models

### PostgreSQL

```sql
-- Users table
CREATE TABLE users (
    user_id     UUID PRIMARY KEY,
    username    VARCHAR(64) NOT NULL UNIQUE,
    total_score BIGINT NOT NULL DEFAULT 0,
    version     INTEGER NOT NULL DEFAULT 0,   -- for optimistic locking
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Actions table (action types with their score values)
CREATE TABLE actions (
    action_id   UUID PRIMARY KEY,
    name        VARCHAR(128) NOT NULL,
    score_value INTEGER NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Submissions table (one record per user action completion attempt)
CREATE TABLE submissions (
    submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(user_id),
    action_id     UUID NOT NULL REFERENCES actions(action_id),
    proof         TEXT NOT NULL,
    status        VARCHAR(16) NOT NULL DEFAULT 'PENDING',  -- PENDING | VALID | INVALID
    processed_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_user_action UNIQUE (user_id, action_id)  -- each user can only claim each action once
);

CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_users_score ON users(total_score DESC);
```

### Redis

```
# Sorted Set — leaderboard
ZADD leaderboard <total_score> <user_id>
ZREVRANGE leaderboard 0 9 WITHSCORES   → top 10

# Distributed lock (Redlock)
SET lock:submit:{user_id}:{action_id} 1 NX EX 30

# Pub/Sub channel
PUBLISH leaderboard:top10 <json_payload>
```

---

## API Specification

### 1. Complete Action & Submit Score

```
POST /api/v1/actions/complete
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request body:**
```json
{
  "action_id": "uuid-of-the-action-instance",
  "proof": "HMAC-SHA256-signed-string-or-opaque-token"
}
```

**Response — 202 Accepted** (async processing):
```json
{
  "submission_id": "uuid",
  "status": "PENDING",
  "message": "Submission received and queued for validation."
}
```

**Error responses:**

| Status | Reason |
|--------|--------|
| 401 | Missing or invalid JWT |
| 409 | This (user_id, action_id) has already been submitted |
| 429 | Rate limit exceeded |

---

### 2. Get Top 10 Scoreboard

```
GET /api/v1/scores/top10
```

No authentication required (public endpoint).

**Response — 200 OK:**
```json
{
  "leaderboard": [
    { "rank": 1, "user_id": "uuid", "username": "alice", "score": 9800 },
    { "rank": 2, "user_id": "uuid", "username": "bob",   "score": 9200 },
    ...
  ],
  "updated_at": "2026-04-09T12:00:00Z"
}
```

Served from **Redis Sorted Set** — no DB query on this hot path.

---

### 3. Live Scoreboard Stream (SSE)

```
GET /api/v1/scores/live
Accept: text/event-stream
```

No authentication required.

**SSE event format:**
```
event: leaderboard_update
data: {"leaderboard": [...top 10...], "updated_at": "..."}

: keepalive
```

The server pushes an update only when the top 10 **actually changes**. A keepalive comment is sent every 30 seconds to maintain the connection.

---

## Execution Flows

### Flow 1 — Score Update

```
Client                  API Server              Kafka           Worker              PostgreSQL      Redis
  │                          │                    │               │                     │              │
  │─ POST /actions/complete ─▶│                    │               │                     │              │
  │  { action_id, proof }    │                    │               │                     │              │
  │                          │─ verify JWT        │               │                     │              │
  │                          │─ rate limit check  │               │                     │              │
  │                          │─ INSERT submissions (PENDING) ─────────────────────────▶│              │
  │                          │─ PUBLISH ──────────▶│               │                     │              │
  │◀─── 202 Accepted ────────│                    │               │                     │              │
  │                          │                    │─ CONSUME ─────▶│                     │              │
  │                          │                    │               │─ Redlock(uid+aid)    │              │
  │                          │                    │               │─ check UNIQUE(uid+aid) ──────────▶│  │
  │                          │                    │               │─ verify proof        │              │
  │                          │                    │               │─ fetch score_value ─▶│              │
  │                          │                    │               │─ UPDATE score + version ──────────▶│  │
  │                          │                    │               │─ ZADD leaderboard ───────────────────▶│
  │                          │                    │               │─ ZREVRANGE 0 9 ──────────────────────▶│
  │                          │                    │               │  (compare with prev top10)            │
  │                          │                    │               │─ PUBLISH leaderboard:top10 ───────────▶│
  │                          │                    │               │─ UPDATE submission VALID ──────────▶│  │
  │                          │                    │               │─ release Redlock     │              │
```

### Flow 2 — Client Subscribes to Live Scoreboard

```
Client                  API Server                          Redis Pub/Sub
  │                          │                                    │
  │─ GET /scores/live ───────▶│                                    │
  │  Accept: text/event-stream│                                    │
  │                          │─ register SSE connection           │
  │                          │─ SUBSCRIBE leaderboard:top10 ──────▶│
  │◀─ 200 (stream open) ─────│                                    │
  │                          │                         (worker publishes update)
  │                          │◀─ message ─────────────────────────│
  │                          │─ fan-out to all local SSE clients  │
  │◀─ event: leaderboard_update │                                  │
  │   data: {...}            │                                    │
```

---

## Race Condition Prevention

The system uses **3 layers of protection**:

### Layer 1 — Idempotency (Duplicate Submission Prevention)

**Problem:** Network retry or user double-submit sends the same `(user_id, action_id)` twice.

**Solution:**
- PostgreSQL `UNIQUE (user_id, action_id)` constraint — DB-level hard stop
- Redis Redlock with key `lock:submit:{user_id}:{action_id}` (TTL: 30s) — prevents concurrent workers from processing the same pair simultaneously

```
Worker receives message:
  → Acquire Redlock("lock:submit:{user_id}:{action_id}")
  → If lock not acquired → another worker is processing this → discard
  → Check DB: does a VALID submission for (user_id, action_id) exist?
  → If yes → skip, release lock, ack message
  → If no → proceed with validation
```

### Layer 2 — Kafka Partition by user_id (Sequential Processing per User)

**Problem:** User completes two different actions simultaneously. Two messages are produced. Could two workers process them concurrently and cause a score race?

**Answer: No.** Because partition key = `user_id`, both messages go to the **same Kafka partition**. A partition is consumed by exactly **one worker** at a time within a consumer group. Therefore, all submissions from the same user are processed **strictly sequentially** — regardless of how many actions they complete simultaneously.

```
user_123 → action_A   \
user_123 → action_B    }──▶  partition-7  ──▶  worker-2 (processes A, then B)
user_456 → action_C   /──▶  partition-3  ──▶  worker-1 (processes C independently)
```

### Layer 3 — Atomic SQL Increment + Optimistic Locking

**Atomic increment** (always applied):
```sql
UPDATE users
SET score   = score + :delta,
    version = version + 1
WHERE user_id = :user_id;
```

This is safe for simple additive updates because the DB handles the read-modify-write atomically.

**Optimistic locking** (applied for complex score logic):

> For the current simple `score + delta` case, the atomic increment above is sufficient. However, if future requirements introduce complex score computation (e.g., *"if score > 1000, apply a 2x multiplier"*), this requires a read → compute → write pattern, which introduces a race window. Optimistic locking handles this.

```sql
-- Step 1: read current state
SELECT score, version FROM users WHERE user_id = :user_id;

-- Step 2: compute new score with complex rules
new_score = compute(old_score, delta, ...)

-- Step 3: conditional write
UPDATE users
SET score = :new_score, version = version + 1
WHERE user_id = :user_id AND version = :expected_version;
```

If `affected_rows = 0` → a concurrent writer updated the record between Step 1 and Step 3 → **retry** (re-read and re-compute) up to 3 times with exponential backoff. If all retries fail → send to **Dead Letter Queue (DLQ)** for investigation. Do **not** silently ack — that would cause silent score loss.

---

## Real-time Scoreboard (SSE)

### Why SSE over WebSocket?

| | SSE | WebSocket |
|---|---|---|
| Direction | Server → Client (one-way) | Bidirectional |
| Protocol | HTTP/1.1 | Separate WS protocol |
| Load balancer support | Native (sticky or stateless with Redis Pub/Sub) | Requires WS-aware LB config |
| Complexity | Low | Higher |
| Use case fit | Scoreboard push | Chat, games |

The scoreboard only needs server-to-client push → SSE is the right tool.

### Multi-instance Fan-out

Each API server instance maintains its own in-memory map of SSE client connections. All instances subscribe to the same Redis Pub/Sub channel. When any worker publishes a leaderboard update, all instances receive it and fan-out to their local clients.

```
Worker
  └─▶ Redis Pub/Sub: "leaderboard:top10"
         ├─▶ API Instance 1 → [client_A, client_B, client_C]
         ├─▶ API Instance 2 → [client_D, client_E]
         └─▶ API Instance 3 → [client_F]
```

### SSE Throttling

To avoid flooding clients during high-frequency score updates:
- Worker compares new top 10 with previous top 10 **before publishing** — only publishes if there is an actual change
- Additional debounce: max **1 broadcast per second** using a Redis-based rate limiter on the publish operation

---

## Security Measures

| Threat | Mitigation |
|---|---|
| Unauthenticated score update | JWT required on `POST /actions/complete` |
| Fake/forged proof | Server verifies `proof` against `action_id` using HMAC or signed token |
| Replay attack | `UNIQUE(user_id, action_id)` — each action instance can only be claimed once |
| Score flooding | Rate limit: max **10 submissions / minute / user** (Redis sliding window) |
| Brute-force proof | Rate limit per IP + account lockout after N failed submissions |
| Man-in-the-middle | HTTPS/TLS enforced on all endpoints |
| Insecure direct object reference | Worker fetches `score_value` from DB — client cannot pass or influence the score value |

### JWT & Proof Flow

```
1. User authenticates → receives JWT (signed by Auth Service)
2. Server issues action_id (UUID) + secret HMAC key when action begins
3. Client completes action → signs action_id with HMAC key → sends as proof
4. Worker verifies: HMAC(action_id, secret) == proof
```

---

## Scalability

| Component | Scaling Strategy |
|---|---|
| API Server | Horizontal scale behind load balancer; stateless (SSE state managed via Redis Pub/Sub) |
| Kafka | Increase partitions to scale worker parallelism; partition key = user_id preserves ordering guarantee |
| Worker | Scale consumer group instances up to the number of Kafka partitions |
| Redis | Redis Cluster for horizontal scaling; Sorted Set operations are O(log N) |
| PostgreSQL | Read replicas for `GET /scores/top10` fallback; primary for writes |

---

## Improvement Suggestions

### 1. Action Token Issuance Endpoint

Currently assumed implicit. A dedicated endpoint to issue `action_id` before the action starts would allow the server to validate that the action was server-initiated, not crafted by a client.

```
POST /api/v1/actions/start  →  returns { action_id, expires_at }
```

### 2. Submission Status Webhook / Polling

Since score updates are async (202 Accepted), clients have no way to know if their submission was VALID or INVALID. Consider:
- `GET /api/v1/submissions/{submission_id}` — poll for status
- Or WebSocket/SSE notification to the specific user when their submission is processed

### 3. Score History & Audit Log

Store every validated score change with a timestamp. This enables:
- Auditing suspicious score jumps
- Rollback of fraudulent scores
- Analytics on action completion rates

### 4. Leaderboard Snapshots

Persist hourly/daily top 10 snapshots to PostgreSQL for historical leaderboard views (e.g., "Top 10 this week").

### 5. Soft Delete for Fraud Handling

Add an `is_banned` flag on `users` and a `revoked_at` on `submissions`. When fraud is detected, ban the user and recompute their score — without hard-deleting records for audit trail purposes.

### 6. Dead Letter Queue Monitoring

Unprocessable messages in DLQ should trigger alerts (PagerDuty, Slack) and be surfaced in an admin dashboard for manual review.
