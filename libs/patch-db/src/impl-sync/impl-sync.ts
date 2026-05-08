import { assert } from '@gamezilla/lib/assert';
import { fireAndForget } from '@gamezilla/lib/async/fire-and-forget';
import { createLogger, type Logger } from '@gamezilla/lib/logger';
import type { PubSub, Unsubscribe } from '@gamezilla/lib/pub-sub/interface';
import type {
  Patch,
  PatchDb,
  PatchDbContext,
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
  WritePatchesResult,
} from '../interface';
import {
  OPEN_PATCHES_DB_CONTEXT,
  PATCH_REJECTED,
  PATCH_SYNC_REJECTED_AT,
  PATCH_SYNC_REJECTED_REASON,
  PATCH_SYNCED_AT,
} from '../interface';
import { PatchDbTransportRejectedError } from '../transport/transport-rejected-error';
import { MAX_PATCHES_PER_REQUEST } from '../transport/wire-schemas';
import {
  ActiveQueryRegistry,
  PATCHES_DB_TOPIC,
  singleResultReader,
  type ActiveQuery,
} from './active-query-registry';
import {
  buildSyncQueriesForPoll,
  mergeRemotePatchesIntoLocal,
  toWireQueriesFromSyncQueries,
} from './impl-sync-poll-helpers';
import {
  clearRejectedPushMarkersOnLocal,
  discardTransportRejectedChunk,
  unsyncedPatchesQueryForPush,
} from './impl-sync-rejected-pushes';
import { createPatchDbReadBatcher } from '../scheduling/microtask-batcher';

/** Topic for sync errors. Subscribe to surface push/poll failures to the UI after consecutive failures. */
export const SYNC_ERROR_TOPIC = 'sync-error';

const MAX_CONSECUTIVE_FAILURES = 5;

export type SyncErrorEvent = {
  source: 'push' | 'poll';
  error: unknown;
};

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
};

const defaultLog = createLogger({ name: 'patch-db:sync' });

export class SyncPatchDb implements PatchDb {
  get hooks() {
    return this.local.hooks;
  }

  get compaction() {
    return this.local.compaction;
  }

  private readonly local: PatchDb;
  private readonly remote: PatchDb;

  private readonly log: Logger;
  private readonly logPushPollFailures: boolean;
  private readonly maxPushBatchSize: number;
  private readonly targetedInvalidation: boolean;
  /** Stops subscription callbacks after {@link destroy} (e.g. HMR / teardown races). */
  private destroyed = false;

  subscribe = {
    patches: (
      query: PatchDbQuery,
      listener: (result: PatchDbResult) => void
    ): Unsubscribe => this.activeQueries.subscribe(query, listener),
    entities: (
      query: PatchDbQuery,
      listener: (result: PatchDbResult) => void
    ): Unsubscribe => this.activeQueries.subscribe(query, listener),
  };

  private activeQueries: ActiveQueryRegistry;
  private pushScheduleHandle: SyncPatchDbScheduleHandle | null = null;
  private pollScheduleHandle: SyncPatchDbScheduleHandle | null = null;
  private pollInProgress = false;
  private pollEmptyLocalPending = false;
  private pushConsecutiveFailures = 0;
  private pollConsecutiveFailures = 0;

  constructor(
    localBackend: PatchDb,
    remoteBackend: PatchDb,
    private pubSub: PubSub,
    private options: SyncPatchDbOptions
  ) {
    this.local = createPatchDbReadBatcher(localBackend);
    this.remote = createPatchDbReadBatcher(remoteBackend);
    this.log = options.logger ?? defaultLog;
    this.logPushPollFailures = options.logPushPollFailures !== false;
    this.maxPushBatchSize = options.maxPushBatchSize ?? MAX_PATCHES_PER_REQUEST;
    this.targetedInvalidation = options.targetedInvalidation === true;
    assert.ok(
      Number.isSafeInteger(this.maxPushBatchSize) &&
        this.maxPushBatchSize > 0 &&
        this.maxPushBatchSize <= MAX_PATCHES_PER_REQUEST,
      'maxPushBatchSize must be a positive integer not exceeding MAX_PATCHES_PER_REQUEST',
      {
        maxPushBatchSize: this.maxPushBatchSize,
        wireMax: MAX_PATCHES_PER_REQUEST,
      }
    );
    this.activeQueries = new ActiveQueryRegistry({
      read: singleResultReader(this.local),
      pubSub: this.pubSub,
      isDestroyed: () => this.destroyed,
      targetedInvalidation: this.targetedInvalidation,
      onFirstSubscriber: () => this.ensurePollTimer(),
      onLastUnsubscribe: () => this.maybeStopPollTimer(),
      onHydratedEmptyOnce: () => {
        // Best-effort acceleration for newly subscribed queries that read empty locally:
        // trigger one extra poll so we don't wait for the next interval tick.
        this.maybePollSoonAfterHydratedEmpty();
      },
    });
    this.ensurePushTimer();
  }

  private maybePollSoonAfterHydratedEmpty(): void {
    if (this.destroyed) return;
    const pollDriver = this.options.pollDriver ?? 'interval';
    if (pollDriver === 'manual') return;
    if (this.pollScheduleHandle === null) return;
    // One-shot latch: if multiple empty reads arrive in a burst, we still only
    // want at most one follow-up poll.
    if (this.pollEmptyLocalPending) return;
    this.pollEmptyLocalPending = true;
    if (this.pollInProgress) return;
    fireAndForget(this.poll(), {
      component: 'SyncPatchDb',
      op: 'poll-empty-local',
    });
  }

  /**
   * Runs a single push cycle (read unsynced locals -> remote.write -> local.update synced flags).
   * Use with {@link SyncPatchDbOptions.pushDriver} `"manual"` or to force an extra push.
   */
  async runPushNow(): Promise<void> {
    await this.pushUnsynced();
  }

  /**
   * Pushes pending local patches once, then throws if the server rejected any
   * patch in the chunk or the transport returned 401/403. Still applies local
   * rejection markers (same as the interval push path). Use when the caller
   * must surface failure to the user (e.g. sign-out).
   */
  async runPushNowStrict(): Promise<void> {
    if (this.destroyed) return;
    const [result] = await this.local.read(
      [unsyncedPatchesQueryForPush()],
      OPEN_PATCHES_DB_CONTEXT
    );
    assert.ok(
      result !== null && result !== undefined,
      'read([query]) must return one result'
    );
    const patches = result.patches;
    if (patches.length === 0) return;
    await this.pushUnsyncedChunksThenPoll(patches, { strictRejections: true });
  }

  /**
   * Runs a single poll cycle (merge remote patches for active subscription queries).
   * Use with {@link SyncPatchDbOptions.pollDriver} `"manual"` or to force an extra poll.
   */
  async runPollNow(): Promise<void> {
    await this.poll();
  }

  /**
   * Publishes an invalidation so active subscription listeners re-read from the local db.
   * Call after out-of-band mutations (e.g. raw SQL wipes) that bypass {@link write}.
   */
  notifyInvalidated(): void {
    this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
  }

  /**
   * Await completion of all currently in-flight subscription reads.
   *
   * Intended for UI cache warmers that want `write()` to resolve only after
   * existing subscriptions have re-read the local DB for the invalidation.
   */
  flushPendingReads(): Promise<void> {
    return this.activeQueries.flushInFlight();
  }

  /** Stops push and poll timers. Call before disposing of the db. */
  destroy(): void {
    this.destroyed = true;
    if (
      this.pushScheduleHandle !== null &&
      this.pushScheduleHandle !== undefined
    ) {
      this.pushScheduleHandle.cancel();
      this.pushScheduleHandle = null;
    }
    if (
      this.pollScheduleHandle !== null &&
      this.pollScheduleHandle !== undefined
    ) {
      this.pollScheduleHandle.cancel();
      this.pollScheduleHandle = null;
    }
  }

  async write(
    patches: PatchInput[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<WritePatchesResult> {
    const withUnsynced = patches.map((p) => ({
      ...p,
      attributes: {
        ...p.attributes,
        [PATCH_SYNCED_AT]: null,
      },
    }));
    const result = await this.local.write(withUnsynced, ctx);
    const touched =
      this.targetedInvalidation && result.accepted.length > 0
        ? result.accepted.map((p) => ({
            entityType: p.entityType,
            entityId: p.entityId,
          }))
        : undefined;
    this.pubSub.publish(PATCHES_DB_TOPIC, {
      type: 'invalidated',
      ...(touched !== undefined ? { touched } : {}),
    });
    return result;
  }

  read(
    queries: PatchDbQuery[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<PatchDbResult[]> {
    return this.local.read(queries, ctx);
  }

  async update(
    updates: { patchId: string; attributes: Record<string, unknown> }[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<void> {
    return this.local.update(updates, ctx);
  }

  private ensurePollTimer(): void {
    if (
      this.pollScheduleHandle !== null &&
      this.pollScheduleHandle !== undefined
    )
      return;
    const pollDriver = this.options.pollDriver ?? 'interval';
    if (pollDriver === 'manual') return;
    const pollIntervalMs = this.options.pollIntervalMs ?? 5000;
    const scheduler = this.options.scheduler ?? defaultSyncPatchDbScheduler;
    this.pollScheduleHandle = scheduler.scheduleInterval(pollIntervalMs, () => {
      fireAndForget(this.poll(), {
        component: 'SyncPatchDb',
        op: 'poll-interval',
      });
    });
    fireAndForget(this.poll(), {
      component: 'SyncPatchDb',
      op: 'poll-initial',
    });
  }

  private maybeStopPollTimer(): void {
    if (
      this.activeQueries.size() === 0 &&
      this.pollScheduleHandle !== null &&
      this.pollScheduleHandle !== undefined
    ) {
      this.pollScheduleHandle.cancel();
      this.pollScheduleHandle = null;
    }
  }

  private ensurePushTimer(): void {
    if (
      this.pushScheduleHandle !== null &&
      this.pushScheduleHandle !== undefined
    )
      return;
    const pushDriver = this.options.pushDriver ?? 'interval';
    if (pushDriver === 'manual') return;
    const pushIntervalMs = this.options.pushIntervalMs ?? 2000;
    const scheduler = this.options.scheduler ?? defaultSyncPatchDbScheduler;
    this.pushScheduleHandle = scheduler.scheduleInterval(pushIntervalMs, () => {
      fireAndForget(this.pushUnsynced(), {
        component: 'SyncPatchDb',
        op: 'pushUnsynced',
      });
    });
  }

  private assertChunkMatchesWriteResult(
    chunk: readonly Patch[],
    result: WritePatchesResult
  ): void {
    assert.ok(
      result.accepted.length + result.rejected.length === chunk.length,
      'remote.write must account for every patch in chunk',
      {
        chunk: chunk.length,
        accepted: result.accepted.length,
        rejected: result.rejected.length,
      }
    );
    const ids = new Set(chunk.map((p) => p.patchId));
    for (const p of result.accepted) {
      assert.ok(ids.has(p.patchId), 'accepted patchId must be from chunk');
    }
    for (const r of result.rejected) {
      assert.ok(ids.has(r.patchId), 'rejected patchId must be from chunk');
    }
  }

  private async applyChunkPushWriteResult(
    result: WritePatchesResult
  ): Promise<void> {
    const now = new Date().toISOString();
    const updates = [
      ...result.accepted.map((p) => ({
        patchId: p.patchId,
        attributes: { [PATCH_SYNCED_AT]: '1' },
      })),
      ...result.rejected.map((r) => ({
        patchId: r.patchId,
        attributes: {
          [PATCH_SYNC_REJECTED_AT]: now,
          [PATCH_SYNC_REJECTED_REASON]: `${String(r.code)}: ${String(r.reason)}`.slice(
            0,
            256
          ),
          [PATCH_REJECTED]: true,
        },
      })),
    ];
    if (updates.length > 0) {
      await this.local.update(updates, OPEN_PATCHES_DB_CONTEXT);
    }
    this.pushConsecutiveFailures = 0;
    this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
  }

  /**
   * Clears push-rejection markers on local patches so a later push can retry
   * (e.g. after session/auth is fixed). Rows are never deleted.
   */
  async clearRejectedPushes(): Promise<void> {
    await clearRejectedPushMarkersOnLocal(this.local, this.pubSub);
  }

  /**
   * Marks patches as synced for local outbox bookkeeping when the server
   * already holds authoritative rows (e.g. `accountSession` from OAuth claim)
   * and local rows are mirrors that must not be sent via {@link remote.write}.
   */
  async markPatchesAsAlreadyOnRemote(
    patchIds: readonly string[]
  ): Promise<void> {
    if (patchIds.length === 0) return;
    await this.local.update(
      patchIds.map((patchId) => ({
        patchId,
        attributes: { [PATCH_SYNCED_AT]: '1' },
      })),
      OPEN_PATCHES_DB_CONTEXT
    );
    this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
  }

  /**
   * Drops every unsynced patch for `entityType` from the push outbox. Use for
   * server-authoritative entity types (e.g. `accountSession`) where every
   * client-side write is either a mirror of a server-applied row (OAuth
   * claim) or a local revoke whose authoritative copy has already been
   * applied server-side via a side-channel (e.g. `POST /auth/sign-out`).
   * Pushing either kind would race the cleared Bearer and bounce off ABAC
   * with `accountSession is system-managed`.
   */
  async markAllUnsyncedPatchesForEntityTypeAsAlreadyOnRemote(
    entityType: string
  ): Promise<void> {
    const [result] = await this.local.read(
      [unsyncedPatchesQueryForPush()],
      OPEN_PATCHES_DB_CONTEXT
    );
    assert.ok(
      result !== null && result !== undefined,
      'read([query]) must return one result'
    );
    const patchIds = result.patches
      .filter((p) => p.entityType === entityType)
      .map((p) => p.patchId);
    await this.markPatchesAsAlreadyOnRemote(patchIds);
  }

  private logPushFailure(err: unknown): void {
    this.pushConsecutiveFailures += 1;
    if (!this.logPushPollFailures) return;
    this.log.error('push failed', {
      error: err instanceof Error ? err.message : String(err),
      consecutiveFailures: this.pushConsecutiveFailures,
    });
  }

  private publishPushFatalIfNeeded(err: unknown): void {
    if (this.pushConsecutiveFailures < MAX_CONSECUTIVE_FAILURES) return;
    this.pubSub.publish(SYNC_ERROR_TOPIC, {
      source: 'push',
      error: err,
    } satisfies SyncErrorEvent);
  }

  /**
   * Pushes `patches` in order in wire-sized chunks; on 401/403 marks the
   * failing chunk rejected locally and returns without polling.
   */
  private async pushUnsyncedChunksThenPoll(
    patches: readonly Patch[],
    opts: { strictRejections?: boolean } = {}
  ): Promise<void> {
    const batchSize = this.maxPushBatchSize;
    const strict = opts.strictRejections === true;
    for (let i = 0; i < patches.length; i += batchSize) {
      if (this.destroyed) return;
      const chunk = patches.slice(i, i + batchSize);
      try {
        const writeResult = await this.remote.write(
          chunk,
          OPEN_PATCHES_DB_CONTEXT
        );
        this.assertChunkMatchesWriteResult(chunk, writeResult);
        await this.applyChunkPushWriteResult(writeResult);
        if (strict && writeResult.rejected.length > 0) {
          const detail = writeResult.rejected
            .map((r) => r.reason || r.code)
            .join('; ');
          throw new Error(detail.length > 0 ? detail : 'patch push rejected');
        }
      } catch (chunkErr) {
        if (chunkErr instanceof PatchDbTransportRejectedError) {
          await discardTransportRejectedChunk({
            local: this.local,
            chunk,
            err: chunkErr,
            pubSub: this.pubSub,
            log: this.log,
            logPushPollFailures: this.logPushPollFailures,
          });
          this.pushConsecutiveFailures = 0;
          if (strict) {
            throw chunkErr;
          }
          return;
        }
        throw chunkErr;
      }
    }
    await this.poll();
  }

  private async pushUnsynced(): Promise<void> {
    if (this.destroyed) return;
    try {
      const [result] = await this.local.read(
        [unsyncedPatchesQueryForPush()],
        OPEN_PATCHES_DB_CONTEXT
      );
      assert.ok(
        result !== null && result !== undefined,
        'read([query]) must return one result'
      );
      const patches = result.patches;
      if (patches.length === 0) {
        this.pushConsecutiveFailures = 0;
        return;
      }
      await this.pushUnsyncedChunksThenPoll(patches);
    } catch (err) {
      this.logPushFailure(err);
      this.publishPushFatalIfNeeded(err);
    }
  }

  private async runPollMergeOnce(
    entries: ActiveQuery[]
  ): Promise<{ hasNewPatches: boolean }> {
    const syncQueries = await buildSyncQueriesForPoll(this.local, entries);
    const wireQueries = toWireQueriesFromSyncQueries(syncQueries);
    const results = await this.remote.read(
      wireQueries,
      OPEN_PATCHES_DB_CONTEXT
    );
    const hasNewPatches = await mergeRemotePatchesIntoLocal(
      this.local,
      results
    );
    return { hasNewPatches };
  }

  private onPollFailure(err: unknown): void {
    this.pollConsecutiveFailures += 1;
    if (this.logPushPollFailures) {
      this.log.error('poll failed', {
        error: err instanceof Error ? err.message : String(err),
        consecutiveFailures: this.pollConsecutiveFailures,
      });
    }
    if (this.pollConsecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      this.pubSub.publish(SYNC_ERROR_TOPIC, {
        source: 'poll',
        error: err,
      } satisfies SyncErrorEvent);
    }
  }

  private async poll(): Promise<void> {
    if (this.destroyed) return;
    const entries = this.activeQueries.values();
    if (entries.length === 0) return;
    if (this.pollInProgress) return;

    this.pollInProgress = true;
    try {
      const { hasNewPatches } = await this.runPollMergeOnce(entries);
      this.pollConsecutiveFailures = 0;
      if (hasNewPatches) {
        this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
      }
    } catch (err) {
      this.onPollFailure(err);
    } finally {
      this.pollInProgress = false;
      if (this.pollEmptyLocalPending && !this.destroyed) {
        // Drain the one-shot latch. Fire a single follow-up poll so empty local
        // queries that arrived mid-poll don't wait for the next interval tick.
        this.pollEmptyLocalPending = false;
        fireAndForget(this.poll(), {
          component: 'SyncPatchDb',
          op: 'poll-empty-local-drain',
        });
      }
    }
  }
}
