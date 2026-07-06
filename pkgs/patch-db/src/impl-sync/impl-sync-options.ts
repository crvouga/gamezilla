import type { Logger } from '@pkgs/logger';
import type { Patch, PatchDbResult } from '../interface';

/** Handle returned by {@link SyncPatchDbScheduler.scheduleInterval}. */
export type SyncPatchDbScheduleHandle = {
  cancel: () => void;
};

/**
 * Injectable interval scheduler (default uses `setInterval`).
 * Use in tests with a deterministic scheduler.
 */
export type SyncPatchDbScheduler = {
  scheduleInterval(
    intervalMs: number,
    callback: () => void
  ): SyncPatchDbScheduleHandle;
};

export const defaultSyncPatchDbScheduler: SyncPatchDbScheduler = {
  scheduleInterval(intervalMs, callback) {
    const id = setInterval(callback, intervalMs);
    return {
      cancel: () => clearInterval(id),
    };
  },
};

export type SyncPatchDbOptions = {
  pushIntervalMs?: number;
  pollIntervalMs?: number;
  /**
   * `interval` (default): repeat {@link SyncPatchDb.runPushNow} on a timer.
   * `manual`: no timer; call {@link SyncPatchDb.runPushNow} explicitly (tests / simulation).
   */
  pushDriver?: 'interval' | 'manual';
  /**
   * `interval` (default): repeat {@link SyncPatchDb.runPollNow} on a timer.
   * `manual`: no timer; call {@link SyncPatchDb.runPollNow} explicitly (tests / simulation).
   */
  pollDriver?: 'interval' | 'manual';
  /** Scheduler for push and poll timers (default: real-time `setInterval`). */
  scheduler?: SyncPatchDbScheduler;
  /**
   * When false, failed push/poll cycles are not logged to stderr (failures still increment counters and may publish {@link SYNC_ERROR_TOPIC}).
   * Default true. Deterministic sim tests set this to false to avoid expected-failure noise.
   */
  logPushPollFailures?: boolean;
  /** Structured logger for push/poll diagnostics. Falls back to a default logger if omitted. */
  logger?: Logger;
  /**
   * Maximum number of patches sent per `remote.write` call. Defaults to
   * {@link MAX_PATCHES_PER_REQUEST}. Overridable for deterministic tests; in
   * production this MUST stay at or below the wire contract bound — the HTTP
   * client transport will crash if a single request exceeds it.
   */
  maxPushBatchSize?: number;
  /**
   * When true, local writes publish invalidation `touched` hints so
   * {@link ActiveQueryRegistry} can skip re-reads for unrelated single-entity
   * subscriptions. Default false.
   */
  targetedInvalidation?: boolean;
  /**
   * Called after each successful remote poll merge with the raw remote read
   * results. Used by the client to upsert reference-data snapshots (e.g.
   * `chess.puzzle`) into the in-memory query store without waiting for a full
   * SQLite hydration pass.
   */
  onPollMerged?: (results: readonly PatchDbResult[]) => void;
  /**
   * When signed in, anonymous patches stamped with the install device id must
   * not share a push batch with account-authored writes (ABAC rejects them).
   */
  shouldQuarantinePatchBeforePush?: (patch: Patch) => boolean;
};
