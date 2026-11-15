// Retry plan for failed autosaves. Pure logic: the editor owns timers and state.
// After the 1st, 2nd and 3rd failure the next attempt follows after 2 s, 5 s and
// 15 s. From the 4th failure on it repeats every 30 s until a save succeeds.
export const RETRY_DELAYS_MS: readonly number[] = [2_000, 5_000, 15_000];
export const RETRY_REPEAT_MS = 30_000;

export type RetryState = { failures: number };
// "failure": an attempt failed. "success": a save went through.
// "online": the browser regained its connection. "manual-save": the person saved.
// The last three restart the plan.
export type RetryEvent = "failure" | "success" | "online" | "manual-save";

export const initialRetryState: RetryState = { failures: 0 };

export function nextRetryState(state: RetryState, event: RetryEvent): RetryState {
  if (event !== "failure") return { failures: 0 };
  const failures = Number.isFinite(state.failures) ? Math.max(0, Math.floor(state.failures)) : 0;
  return { failures: Math.min(failures + 1, Number.MAX_SAFE_INTEGER) };
}

// Delay before the next attempt, or null while nothing has failed.
export function retryDelayMs(state: RetryState): number | null {
  const failures = Number.isFinite(state.failures) ? Math.floor(state.failures) : 0;
  if (failures < 1) return null;
  return RETRY_DELAYS_MS[failures - 1] ?? RETRY_REPEAT_MS;
}

export function retrySeconds(delayMs: number): number {
  return Math.max(1, Math.ceil(delayMs / 1000));
}
