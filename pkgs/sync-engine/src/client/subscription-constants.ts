/** Shared down-state sweep cadence when pubsub is absent or down. */
export const FALLBACK_POLL_MS = 60_000;

/** Anti-entropy repair tick — the only always-on timer while connected. */
export const RECONCILE_MS = 600_000;

/** ± fraction applied to RECONCILE_MS per tick. */
export const RECONCILE_JITTER_RATIO = 0.2;

/** Jitter window for foreground / network / fallback / reconnect sweeps. */
export const LIFECYCLE_SWEEP_JITTER_MS = 3_000;

/** Pubsub status flip sweep jitter (existing degrade rule). */
export const STATUS_POLL_JITTER_MS = 5_000;
