import test from "node:test";
import assert from "node:assert/strict";
import {
  RETRY_REPEAT_MS,
  initialRetryState,
  nextRetryState,
  retryDelayMs,
  retrySeconds,
  type RetryState,
} from "../src/autosaveRetry.ts";

const fail = (state: RetryState, times: number) => {
  for (let i = 0; i < times; i++) state = nextRetryState(state, "failure");
  return state;
};

test("no retry is planned before the first failure", () => {
  assert.equal(retryDelayMs(initialRetryState), null);
});

test("delays follow 2 s, 5 s, 15 s and then every 30 s", () => {
  const delays = [1, 2, 3, 4, 5, 6, 40].map((n) => retryDelayMs(fail(initialRetryState, n)));
  assert.deepEqual(delays, [2_000, 5_000, 15_000, 30_000, 30_000, 30_000, 30_000]);
  assert.equal(RETRY_REPEAT_MS, 30_000);
});

test("online, manual save and success restart the plan", () => {
  const failed = fail(initialRetryState, 5);
  for (const event of ["online", "manual-save", "success"] as const) {
    assert.deepEqual(nextRetryState(failed, event), { failures: 0 });
    assert.equal(retryDelayMs(nextRetryState(failed, event)), null);
  }
  assert.equal(retryDelayMs(nextRetryState(nextRetryState(failed, "online"), "failure")), 2_000);
});

test("a failure never mutates the previous state", () => {
  const before: RetryState = { failures: 2 };
  nextRetryState(before, "failure");
  assert.deepEqual(before, { failures: 2 });
});

test("invalid failure counts are treated as a fresh plan", () => {
  assert.equal(retryDelayMs({ failures: Number.NaN }), null);
  assert.equal(retryDelayMs({ failures: -3 }), null);
  assert.deepEqual(nextRetryState({ failures: Number.NaN }, "failure"), { failures: 1 });
  assert.deepEqual(nextRetryState({ failures: -3 }, "failure"), { failures: 1 });
  assert.equal(retryDelayMs({ failures: 2.9 }), 5_000);
});

test("seconds are rounded up and never below one", () => {
  assert.equal(retrySeconds(2_000), 2);
  assert.equal(retrySeconds(5_000), 5);
  assert.equal(retrySeconds(1_200), 2);
  assert.equal(retrySeconds(0), 1);
});
