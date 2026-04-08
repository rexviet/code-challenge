/**
 * Problem 4: Three ways to sum to n
 * Input: n - any integer
 * Output: summation from 1 to n, e.g. sum_to_n(5) === 1+2+3+4+5 === 15
 *
 * Note: assumes input always produces a result < Number.MAX_SAFE_INTEGER
 */

/**
 * Implementation A: Gauss formula
 * Time complexity:  O(1) — single arithmetic expression
 * Space complexity: O(1)
 *
 * Uses the closed-form formula: n * (n + 1) / 2.
 * Note: only valid for n >= 0. Behavior for negative n is undefined by the problem.
 */
function sum_to_n_a(n: number): number {
  return (n * (n + 1)) / 2;
}

/**
 * Implementation B: Iterative loop
 * Time complexity:  O(n) — iterates n times
 * Space complexity: O(1)
 *
 * Straightforward accumulation. Handles negative n by stepping downward.
 */
function sum_to_n_b(n: number): number {
  let sum = 0;
  const step = n >= 0 ? 1 : -1;
  for (let i = step; Math.abs(i) <= Math.abs(n); i += step) {
    sum += i;
  }
  return sum;
}

/**
 * Implementation C: Recursive
 * Time complexity:  O(n) — n recursive calls
 * Space complexity: O(n) — call stack depth proportional to n
 *
 * Each call adds the current n and recurses with n-1 (or n+1 for negatives).
 * Base case: n === 0 → return 0.
 */
function sum_to_n_c(n: number): number {
  if (n === 0) return 0;
  if (n > 0) return n + sum_to_n_c(n - 1);
  return n + sum_to_n_c(n + 1);
}

export { sum_to_n_a, sum_to_n_b, sum_to_n_c };

// --- Test runner ---
const implementations: [string, (n: number) => number][] = [
  ["sum_to_n_a (Gauss)", sum_to_n_a],
  ["sum_to_n_b (Iterative)", sum_to_n_b],
  ["sum_to_n_c (Recursive)", sum_to_n_c],
];

// Shared test cases (n >= 0, as defined by the problem)
const sharedTests: { input: number; expected: number }[] = [
  { input: 0,    expected: 0 },      // edge: zero
  { input: 1,    expected: 1 },      // single step
  { input: 5,    expected: 15 },     // example from problem
  { input: 10,   expected: 55 },     // typical positive
  { input: 100,  expected: 5050 },   // Gauss's classic
  { input: 1000, expected: 500500 }, // larger input
];

// Extra cases for implementations that support negative n (B and C)
const negativeTests: { input: number; expected: number }[] = [
  { input: -1,   expected: -1 },
  { input: -5,   expected: -15 },
];

const testMatrix: [string, (n: number) => number, { input: number; expected: number }[]][] = [
  ["sum_to_n_a (Gauss)",     sum_to_n_a, sharedTests],
  ["sum_to_n_b (Iterative)", sum_to_n_b, [...sharedTests, ...negativeTests]],
  ["sum_to_n_c (Recursive)", sum_to_n_c, [...sharedTests, ...negativeTests]],
];

let allPassed = true;
for (const [name, fn, cases] of testMatrix) {
  console.log(`\n${name}`);
  for (const { input, expected } of cases) {
    const result = fn(input);
    const pass = result === expected;
    if (!pass) allPassed = false;
    console.log(`  n=${String(input).padStart(5)} → ${String(result).padStart(7)}  ${pass ? "✓" : `✗ (expected ${expected})`}`);
  }
}

console.log(allPassed ? "\nAll tests passed ✓" : "\nSome tests FAILED ✗");
