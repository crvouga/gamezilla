/** Coalesce window for enqueue → single-flight batch flush (trailing). */
export const QUERY_COALESCE_MS = 0;

/**
 * Safety-net refetch interval for missed `notifyChannels` / lost push.
 * Product default; harness overrides to a shorter interval. `<= 0` disables.
 */
export const QUERY_RECONCILE_INTERVAL_MS = 30_000;

/** Harness default — short enough for default `until` budget (2s). */
export const HARNESS_QUERY_RECONCILE_INTERVAL_MS = 500;
