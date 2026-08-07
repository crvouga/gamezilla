/** Coalesce window for enqueue → single-flight batch flush (trailing). */
export const QUERY_COALESCE_MS = 0;

/** Pubsub reconnect catch-up sweep jitter. */
export const STATUS_POLL_JITTER_MS = 5_000;

export type SweepReason = 'nudge' | 'reconnect' | 'manual';
