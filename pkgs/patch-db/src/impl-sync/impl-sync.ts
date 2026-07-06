import { assert, AssertCrashError } from '@pkgs/assert';
import { fireAndForget } from '@pkgs/async/fire-and-forget';
import { createLogger, type Logger } from '@pkgs/logger';
import type { PubSub, Unsubscribe } from '@pkgs/pub-sub/interface';
import {
  OPEN_PATCHES_DB_CONTEXT,
  PATCH_SYNCED_AT,
  toAttributeState,
  type PatchDb,
  type PatchDbContext,
  type PatchDbQuery,
  type PatchDbResult,
  type PatchInput,
  type WritePatchesResult,
} from '../interface';
import {
  ActiveQueryRegistry,
  PATCHES_DB_INVALIDATED_TYPE,
  PATCHES_DB_TOPIC,
  singleResultReader,
  type ActiveQuery,
} from './active-query-registry';
import {
  buildSyncQueriesForPoll,
  mergeRemotePatchesIntoLocal,
  toWireQueriesFromSyncQueries,
} from './impl-sync-poll-helpers';
import { MAX_PATCHES_PER_REQUEST } from '../transport/wire-schemas';
import { createPatchDbReadBatcher } from '../scheduling/microtask-batcher';
import {
  filterQuarantinedPatchesBeforePush,
  pushUnsynced,
  pushUnsyncedChunksThenPoll,
  assertChunkMatchesWriteResult,
  applyChunkPushWriteResult,
} from './impl-sync-push';
import {
  markAllUnsyncedPatchesForEntityTypeAsAlreadyOnRemote,
  markPatchesAsAlreadyOnRemote,
  markUnsyncedPatchesWithCreatedByAsAlreadyOnRemote,
} from './impl-sync-outbox';
import {
  clearRejectedPushMarkersOnLocal,
  unsyncedPatchesQueryForPush,
} from './impl-sync-rejected-pushes';
import { SYNC_ERROR_TOPIC, type SyncErrorEvent } from './impl-sync-topics';
import {
  defaultSyncPatchDbScheduler,
  type SyncPatchDbOptions,
  type SyncPatchDbScheduleHandle,
} from './impl-sync-options';

export {
  defaultSyncPatchDbScheduler,
  type SyncPatchDbOptions,
  type SyncPatchDbScheduleHandle,
  type SyncPatchDbScheduler,
} from './impl-sync-options';

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
  private readonly onPollMerged: SyncPatchDbOptions['onPollMerged'];
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
  private pushInProgress = false;
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
    this.onPollMerged = options.onPollMerged;
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
    await this.runPushCycle(false);
  }

  /**
   * Pushes pending local patches once, then throws if the server rejected any
   * patch in the chunk or the transport returned 401/403. Still applies local
   * rejection markers (same as the interval push path). Use when the caller
   * must surface failure to the user (e.g. sign-out).
   */
  async runPushNowStrict(): Promise<void> {
    await this.runPushCycle(true);
  }

  private pushIdle: Promise<void> = Promise.resolve();

  /** Serialize push work; interval ticks skip when busy, strict/manual wait. */
  private async runPushCycle(strict: boolean): Promise<void> {
    if (this.destroyed) return;
    if (this.pushInProgress) {
      if (!strict) return;
      await this.pushIdle;
      if (this.destroyed) return;
    }
    if (this.pushInProgress) return;

    let releaseIdle!: () => void;
    this.pushIdle = new Promise<void>((resolve) => {
      releaseIdle = resolve;
    });
    this.pushInProgress = true;
    try {
      if (strict) {
        const [result] = await this.local.read(
          [unsyncedPatchesQueryForPush()],
          OPEN_PATCHES_DB_CONTEXT
        );
        assert.ok(
          result !== null && result !== undefined,
          'read([query]) must return one result'
        );
        const patches = await filterQuarantinedPatchesBeforePush(
          this.pushDeps(),
          result.patches
        );
        if (patches.length === 0) return;
        await pushUnsyncedChunksThenPoll(this.pushDeps(), patches, {
          strictRejections: true,
        });
        return;
      }
      await pushUnsynced(this.pushDeps());
    } finally {
      this.pushInProgress = false;
      releaseIdle();
    }
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
  notifyInvalidated = (): void => this.publishInvalidation();

  private publishInvalidation(
    touched?: readonly { entityType: string; entityId: string }[]
  ): void {
    const msg = {
      type: PATCHES_DB_INVALIDATED_TYPE,
      ...(touched && { touched }),
    };
    this.pubSub.publish(PATCHES_DB_TOPIC, msg);
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
      attributes: toAttributeState({
        ...p.attributes,
        [PATCH_SYNCED_AT]: null,
      }),
    }));
    const result = await this.local.write(withUnsynced, ctx);
    const touched =
      this.targetedInvalidation && result.accepted.length > 0
        ? result.accepted.map((p) => ({
            entityType: p.entityType,
            entityId: p.entityId,
          }))
        : undefined;
    this.publishInvalidation(touched);
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
      fireAndForget(this.runPushCycle(false), {
        component: 'SyncPatchDb',
        op: 'push-interval',
      });
    });
  }

  private pushDeps() {
    return {
      local: this.local,
      remote: this.remote,
      pubSub: this.pubSub,
      log: this.log,
      logPushPollFailures: this.logPushPollFailures,
      maxPushBatchSize: this.maxPushBatchSize,
      isDestroyed: () => this.destroyed,
      getPushConsecutiveFailures: () => this.pushConsecutiveFailures,
      setPushConsecutiveFailures: (n: number) => {
        this.pushConsecutiveFailures = n;
      },
      assertChunkMatchesWriteResult,
      applyChunkPushWriteResult: async (result: WritePatchesResult) => {
        await applyChunkPushWriteResult(this.local, result);
        this.pushConsecutiveFailures = 0;
        this.publishInvalidation();
      },
      poll: () => this.poll(),
      ...(this.options.shouldQuarantinePatchBeforePush !== undefined
        ? {
            shouldQuarantinePatchBeforePush:
              this.options.shouldQuarantinePatchBeforePush,
            quarantinePatchesBeforePush: (patchIds: readonly string[]) =>
              this.markPatchesAsAlreadyOnRemote(patchIds),
          }
        : {}),
    };
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
    await markPatchesAsAlreadyOnRemote(this.local, patchIds);
    this.publishInvalidation();
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
    await markAllUnsyncedPatchesForEntityTypeAsAlreadyOnRemote(
      this.local,
      entityType
    );
    this.publishInvalidation();
  }

  /**
   * Drops unsynced outbox rows stamped with a prior replication identity (e.g.
   * install `deviceId` patches after sign-in when `myId` becomes `accountId`).
   * Without this, batched pushes reject stale rows with
   * `patch/created-by-id must match author`.
   */
  async markUnsyncedPatchesWithCreatedByAsAlreadyOnRemote(
    createdBy: string
  ): Promise<void> {
    await markUnsyncedPatchesWithCreatedByAsAlreadyOnRemote(
      this.local,
      createdBy
    );
    this.publishInvalidation();
  }

  private onPollFailure(err: unknown): void {
    if (err instanceof AssertCrashError) {
      throw err;
    }
    this.pollConsecutiveFailures += 1;
    if (this.logPushPollFailures) {
      this.log.error('poll failed', {
        error: err instanceof Error ? err.message : String(err),
        consecutiveFailures: this.pollConsecutiveFailures,
      });
    }
    if (this.pollConsecutiveFailures >= 5) {
      this.pubSub.publish(SYNC_ERROR_TOPIC, {
        source: 'poll',
        error: err,
      } satisfies SyncErrorEvent);
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
    this.onPollMerged?.(results);
    return { hasNewPatches };
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
        this.publishInvalidation();
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
