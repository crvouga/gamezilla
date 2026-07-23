/** Minimum time the loading face stays up (avoids flicker on fast local opens). */
export const ACCOUNT_SWITCH_MIN_LOADING_MS = 700;

/** How long the success face stays up before auto-dismiss (matches useMutationButton). */
export const ACCOUNT_SWITCH_SUCCESS_HOLD_MS = 900;

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Remaining time to reach `minMs` since `startedAt`; 0 when already past. */
export function remainingMs(startedAt: number, minMs: number): number {
  return Math.max(0, minMs - (Date.now() - startedAt));
}
