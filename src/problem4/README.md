# Problem 4 – Three Ways to Sum to N

## Task

Provide 3 unique implementations of a function that returns the summation from 1 to `n`.

```
sum_to_n(5) === 1 + 2 + 3 + 4 + 5 === 15
```

**Input**: `n` – any integer (result is always < `Number.MAX_SAFE_INTEGER`)

---

## Implementations

### A — Gauss Formula `O(1)` time, `O(1)` space

```ts
function sum_to_n_a(n: number): number {
  return (n * (n + 1)) / 2;
}
```

Uses the classic closed-form formula. Constant time regardless of `n`.
> Note: only valid for `n >= 0`.

---

### B — Iterative Loop `O(n)` time, `O(1)` space

```ts
function sum_to_n_b(n: number): number {
  let sum = 0;
  const step = n >= 0 ? 1 : -1;
  for (let i = step; Math.abs(i) <= Math.abs(n); i += step) {
    sum += i;
  }
  return sum;
}
```

Accumulates the sum step by step. Also handles negative `n` by stepping in the correct direction.

---

### C — Recursion `O(n)` time, `O(n)` space

```ts
function sum_to_n_c(n: number): number {
  if (n === 0) return 0;
  if (n > 0) return n + sum_to_n_c(n - 1);
  return n + sum_to_n_c(n + 1);
}
```

Each call adds the current value and recurses toward 0. Stack depth is proportional to `n`, so this is the least memory-efficient of the three. Handles negative `n`.

---

## Complexity Summary

| Implementation | Time | Space | Handles negative n |
|---|---|---|---|
| A – Gauss formula | O(1) | O(1) | No |
| B – Iterative | O(n) | O(1) | Yes |
| C – Recursive | O(n) | O(n) | Yes |

---

## Running the Tests

```bash
ts-node --skip-project --compiler-options '{"lib":["es2020","dom"]}' src/problem4/index.ts
```
