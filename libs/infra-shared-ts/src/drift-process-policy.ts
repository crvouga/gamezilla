/**
 * How a timed-out or cancelled drift child is stopped.
 *
 * Health 42102265025 SIGKILL'd the process group while OpenTofu still held
 * foundation/dev's state lock, abandoning 31eedd87-d82f-6855-2162-0d37abf22196.
 * Interrupt first so OpenTofu can release; only then kill leftovers. Read-only
 * drift also plans with `-lock=false`, so even a hard kill cannot leave a lock.
 */
export const DRIFT_STOP_SIGNALS = ['SIGINT', 'SIGKILL'] as const;

export type DriftStopSignal = (typeof DRIFT_STOP_SIGNALS)[number];
