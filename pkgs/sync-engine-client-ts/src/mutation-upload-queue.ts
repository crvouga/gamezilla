import { SpanStatusCode } from '@opentelemetry/api';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type { Timers } from '@pkgs/clock-shared-ts/types';
import { isHttpAbortError } from '@pkgs/http-client-shared-ts/errors';
import { HttpNetworkError } from '@pkgs/http-client-shared-ts/http-network-error';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import { events } from '@pkgs/observability-root-shared-ts/events';
import { withSpan } from '@pkgs/observability-root-shared-ts/span';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql, { join } from '@pkgs/sql-root-shared-ts/sql';
import type { AppLifecycle } from '@pkgs/sync-engine-shared-ts/app-lifecycle';
import { MAX_MUTATIONS_BATCH } from '@pkgs/sync-engine-shared-ts/bounds';
import { mutationOriginLink } from '@pkgs/sync-engine-shared-ts/mutation-observability';
import { recordPushApplied } from '@pkgs/sync-engine-shared-ts/push-applied';
import type {
  MutationBatchResponse,
  MutationRequestItem,
  MutationVerdict,
} from '@pkgs/sync-engine-shared-ts/v2';
import { fitUploadBatch, oversizedVerdict } from './mutation-upload-batch';
import { clearOptimisticRowsForMutation } from './optimistic-own-rows';
import { raceUntilAborted } from './race-until-aborted';
import { SyncHttpPayloadTooLargeError } from './sync-http-payload-too-large-error';
import { parseRateLimitRetryMs } from './sync-http-rate-limit-error';
import type { TableChangeBus } from './table-change-bus';

// The wire accepts larger batches, but replay holds a pooled database session
// for the whole request. Keep an offline backlog from monopolizing that hold.
const BATCH_LIMIT = Math.min(4, MAX_MUTATIONS_BATCH);
const MAX_SQLITE_VARS = 999;
/** Fallback poll when nothing is pending; wakes interrupt this wait. */
const IDLE_DELAY_MS = 100;
const ERROR_DELAY_MS = 2_000;
const MAX_ERROR_DELAY_MS = 60_000;

/** Runtime/port alias of protocol {@link MutationRequestItem}. */
export type MutationUploadRow = MutationRequestItem;

/** Runtime/port alias of protocol {@link MutationVerdict}. */
export type MutationUploadVerdict = MutationVerdict;

/** Runtime/port alias of protocol {@link MutationBatchResponse}. */
export type MutationUploadResult = MutationBatchResponse;

type StoredMutation = {
  readonly id: string;
  readonly name: string;
  readonly args: string;
  readonly client_id: string;
  readonly seq: number;
  readonly created_at: string;
  readonly origin_traceparent: string | null;
  readonly origin_session_id: string | null;
  readonly origin_build_sha: string | null;
};

export type MutationUploadQueueOptions = {
  readonly db: SqlClient;
  readonly bus: TableChangeBus;
  readonly clientId: () => string;
  readonly postBatch: (
    mutations: readonly MutationUploadRow[]
  ) => Promise<MutationUploadResult>;
  readonly onError: (error: unknown) => void;
  /**
   * Sync fence fired before applied acks delete queue rows. Bump query
   * generations so in-flight pre-replay sweeps drop instead of merging a
   * stale snapshot once the pending mutation is no longer there to rebase.
   */
  readonly onAckFence?: (() => void) | undefined;
  /** Refetch after refused optimistic writes leave the replay queue. */
  readonly onRejected?: (() => Promise<void>) | undefined;
  readonly timers: Timers;
  readonly lifecycle?: AppLifecycle | undefined;
  readonly now: () => number;
  readonly random?: () => number;
  readonly waitUntilAvailable?: (signal?: AbortSignal | null) => Promise<void>;
};

function toWireRow(row: StoredMutation): MutationUploadRow {
  return {
    id: row.id,
    name: row.name,
    args: row.args,
    clientId: row.client_id,
    seq: row.seq,
    createdAt: row.created_at,
    originTraceparent: row.origin_traceparent,
    ...(row.origin_session_id === null || row.origin_build_sha === null
      ? {}
      : {
          correlation: {
            sessionId: row.origin_session_id,
            buildSha: row.origin_build_sha,
          },
        }),
  };
}

async function readPending(
  db: SqlClient,
  clientId: string,
  limit: number
): Promise<readonly StoredMutation[]> {
  const rows = await db.query(sql<StoredMutation>`
    SELECT id, name, args, client_id, seq, created_at, origin_traceparent,
      origin_session_id, origin_build_sha
    FROM sync_engine_mutations
    WHERE client_id = ${clientId}
      AND deleted_at IS NULL
    ORDER BY seq ASC
    LIMIT ${limit}
  `);
  for (const row of rows) {
    assert.ok(row.id.length > 0, 'sync_engine_mutations id must be non-empty');
    assert.ok(row.seq > 0, 'sync_engine_mutations seq must be positive');
  }
  return rows;
}

async function storeRejection(
  tx: SqlClient,
  clientId: string,
  verdict: Extract<MutationUploadVerdict, { status: 'rejected' }>,
  createdAt: string
): Promise<void> {
  const rejectionId = `local:${verdict.mutationId}`;
  await tx.run(sql`
    INSERT INTO sync_engine_write_rejections (
      id, mutation_id, client_id, code, message, meta,
      created_at, updated_at, deleted_at, acknowledged
    )
    VALUES (
      ${rejectionId},
      ${verdict.mutationId},
      ${clientId},
      ${verdict.code},
      ${verdict.message},
      ${verdict.meta === undefined ? null : JSON.stringify(verdict.meta)},
      ${createdAt},
      ${createdAt},
      ${null},
      ${0}
    )
    ON CONFLICT (id) DO UPDATE SET
      code = excluded.code,
      message = excluded.message,
      meta = excluded.meta,
      updated_at = excluded.updated_at,
      deleted_at = NULL
  `);
}

/**
 * Ack = delete queue row. Applied ids trigger `onAckFence` synchronously,
 * before the delete transaction is even opened: a pre-replay sweep response
 * that lands between "queue row gone" and "generation bumped" would merge its
 * stale snapshot with nothing left to rebase, reviving rows the mutation
 * already changed on the server.
 */
async function applyUploadResult(
  options: MutationUploadQueueOptions,
  pending: readonly StoredMutation[],
  result: MutationUploadResult,
  now: () => number
): Promise<void> {
  if (result.verdicts.length !== pending.length) {
    throw new Error(
      `mutation upload verdict count mismatch: ${result.verdicts.length} verdicts for ${pending.length} pending`
    );
  }
  const pendingIds = new Set(pending.map((row) => row.id));
  for (const verdict of result.verdicts) {
    assert.ok(
      verdict.mutationId.length > 0,
      'mutation verdict id must be non-empty'
    );
    if (!pendingIds.has(verdict.mutationId)) {
      throw new Error(
        `mutation upload verdict id not pending: ${verdict.mutationId}`
      );
    }
  }

  const clientId = options.clientId();
  const nowIso = new Date(now()).toISOString();
  const appliedAny = result.verdicts.some((v) => v.status !== 'rejected');
  if (appliedAny) {
    options.onAckFence?.();
  }
  await options.db.transaction(async (tx) => {
    for (const verdict of result.verdicts) {
      if (verdict.status === 'rejected') {
        await storeRejection(tx, clientId, verdict, nowIso);
      } else {
        await clearOptimisticRowsForMutation(tx, verdict.mutationId, nowIso);
      }
    }
    const ids = result.verdicts.map((v) => v.mutationId);
    const maxIds = Math.max(1, MAX_SQLITE_VARS);
    for (let offset = 0; offset < ids.length; offset += maxIds) {
      const chunk = ids.slice(offset, offset + maxIds);
      await tx.run(sql`
        UPDATE sync_engine_mutations
        SET deleted_at = ${nowIso}, updated_at = ${nowIso}
        WHERE id IN (${join(chunk.map((id) => sql`${id}`))})
          AND deleted_at IS NULL
      `);
    }
  });
  // Floor topic pushSeqs from the ack so own echoed fanout is a no-op.
  if (result.topicPushSeqs !== undefined) {
    for (const [topic, pushSeq] of Object.entries(result.topicPushSeqs)) {
      await recordPushApplied(options.db, topic, pushSeq, {
        now: options.now,
      });
    }
  }
  options.bus.emit(['sync_engine_mutations', 'sync_engine_write_rejections']);
  if (result.verdicts.some((verdict) => verdict.status === 'rejected')) {
    // Refetch repairs the local view; a pending read must not hold later writes.
    void Promise.resolve()
      .then(() => options.onRejected?.())
      .catch(options.onError);
  }

  for (const verdict of result.verdicts) {
    if (verdict.status !== 'rejected') continue;
    const origin = pending.find((row) => row.id === verdict.mutationId);
    const link =
      origin === undefined
        ? undefined
        : mutationOriginLink(
            origin.origin_traceparent,
            origin.created_at,
            verdict.mutationId
          );
    await withSpan(
      'mutation.rejected',
      (span) => {
        events.mutationRejected(span, verdict.mutationId);
        span.setStatus({ code: SpanStatusCode.ERROR, message: verdict.code });
      },
      { [ATTR.APP_MUTATION_ID]: verdict.mutationId },
      link === undefined ? undefined : { links: [link] }
    );
  }
}

/**
 * Polling durable mutation uploader. Ack = delete local queue row.
 * `wake()` is sticky: a wake during drain (when no waiter is armed) still
 * forces an immediate re-drain instead of falling into the idle backstop.
 */
export class MutationUploadQueue {
  private running = false;
  private loopPromise: Promise<void> | null = null;
  private wakeWaiter: (() => void) | null = null;
  /** Set by `wake()`; consumed before idle wait so mid-drain wakes are not lost. */
  private pendingWake = false;
  private availabilityAbort: AbortController | null = null;
  private errorAttempts = 0;
  private online = true;
  private disposeLifecycle: (() => void) | null = null;
  /** Lowered when the server refuses a batch as too large; reset on success. */
  private batchLimit = BATCH_LIMIT;
  private readonly timers: Timers;
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(private readonly options: MutationUploadQueueOptions) {
    this.timers = options.timers;
    this.now = options.now;
    this.random = options.random ?? (() => 0);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.availabilityAbort = new AbortController();
    this.online = this.options.lifecycle?.isOnline() ?? true;
    this.disposeLifecycle =
      this.options.lifecycle?.subscribe((event) => {
        if (event === 'online' || event === 'offline')
          this.setOnline(event === 'online');
      }) ?? null;
    this.loopPromise = this.runLoop();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.disposeLifecycle?.();
    this.disposeLifecycle = null;
    this.pendingWake = true;
    this.availabilityAbort?.abort();
    this.wakeWaiter?.();
    await this.loopPromise;
    this.loopPromise = null;
  }

  wake(): void {
    this.pendingWake = true;
    this.wakeWaiter?.();
  }

  private setOnline(value: boolean): void {
    if (this.online === value) return;
    this.online = value;
    this.errorAttempts = 0;
    if (!value) {
      this.availabilityAbort?.abort();
      this.availabilityAbort = new AbortController();
    }
    this.wake();
  }

  private async waitForOnline(): Promise<void> {
    while (this.running && !this.online) {
      await new Promise<void>((resolve) => {
        this.wakeWaiter = () => {
          this.wakeWaiter = null;
          resolve();
        };
      });
    }
  }

  private consumePendingWake(): boolean {
    if (!this.pendingWake) return false;
    this.pendingWake = false;
    return true;
  }

  private async wait(ms: number): Promise<void> {
    if (!this.running) return;
    if (this.consumePendingWake()) return;
    await new Promise<void>((resolve) => {
      const timer = this.timers.setTimeout(() => {
        this.wakeWaiter = null;
        resolve();
      }, ms);
      this.wakeWaiter = () => {
        this.timers.clearTimeout(timer);
        this.wakeWaiter = null;
        this.pendingWake = false;
        resolve();
      };
    });
  }

  private errorBackoffMs(error: unknown): number {
    const rateMs = parseRateLimitRetryMs(error);
    if (rateMs !== null) return rateMs;
    const base = ERROR_DELAY_MS * 2 ** Math.min(this.errorAttempts, 5);
    const capped = Math.min(MAX_ERROR_DELAY_MS, base);
    const jitter = this.random() * capped * 0.2;
    return Math.floor(capped + jitter);
  }

  /**
   * A batch over the upload's byte cap would be refused on every retry and
   * hold every later write behind it: split it, and give up a single write
   * that can never fit, recording it as refused like any server refusal.
   */
  private async refuseTooLarge(
    pending: readonly StoredMutation[]
  ): Promise<boolean> {
    if (pending.length > 1) {
      this.batchLimit = Math.max(1, Math.floor(pending.length / 2));
      return true;
    }
    const [row] = pending;
    assert.defined(row, 'oversized mutation batch is empty');
    const verdicts = [oversizedVerdict(row.id)];
    const ack = { ok: true as const, serverTimeMs: this.now(), verdicts };
    await applyUploadResult(
      this.options,
      [row],
      { ...ack, ackSeq: 0 },
      this.now
    );
    return true;
  }

  private async drainOnce(): Promise<boolean> {
    const signal = this.availabilityAbort?.signal ?? null;
    const queued = await readPending(
      this.options.db,
      this.options.clientId(),
      this.batchLimit
    );
    assert.ok(
      queued.length <= BATCH_LIMIT,
      'pending mutation batch read bound'
    );
    if (!this.running || queued.length === 0) return false;
    const wire = fitUploadBatch(queued.map(toWireRow));
    if (wire.length === 0) return this.refuseTooLarge(queued.slice(0, 1));
    const pending = queued.slice(0, wire.length);
    await this.options.waitUntilAvailable?.(signal);
    if (!this.running || !this.online || signal?.aborted === true) return false;
    const links = pending.flatMap((row) => {
      if (row.origin_traceparent === null) return [];
      const link = mutationOriginLink(
        row.origin_traceparent,
        row.created_at,
        row.id
      );
      return link === undefined ? [] : [link];
    });
    return withSpan(
      'sync.batch.flush',
      async (span) => {
        for (const row of pending) events.mutationSent(span, row.id);
        const result = await raceUntilAborted(
          this.options.postBatch(wire),
          signal
        ).catch((error: unknown) => {
          if (error instanceof SyncHttpPayloadTooLargeError)
            return 'too_large' as const;
          throw error;
        });
        if (result === 'too_large') return this.refuseTooLarge(pending);
        if (result === null || !this.running) return false;
        await applyUploadResult(this.options, pending, result, this.now);
        events.syncClockSkewObserved(span, result.serverTimeMs - this.now());
        for (const verdict of result.verdicts) {
          events.mutationAcked(span, verdict.mutationId);
        }
        events.syncBatchFlushed(span, pending.length);
        this.errorAttempts = 0;
        this.batchLimit = BATCH_LIMIT;
        return true;
      },
      { [ATTR.APP_SYNC_BATCH_SIZE]: pending.length },
      links.length === 0 ? undefined : { links }
    );
  }

  private async runLoop(): Promise<void> {
    // Event loop: terminates when `stop()` clears `running`.
    while (this.running) {
      assert.ok(this.running, 'upload queue event loop');
      if (!this.online) {
        await this.waitForOnline();
        continue;
      }
      try {
        // Consume the wake that started this attempt so a pre-drain wake
        // cannot skip the error backoff after a failed postBatch.
        this.consumePendingWake();
        const uploaded = await this.drainOnce();
        if (uploaded) {
          // Continuous drain while queue non-empty; mid-flight wakes stick
          // for the next iteration via pendingWake.
          continue;
        }
        await this.wait(IDLE_DELAY_MS);
      } catch (error) {
        if (!(await this.recoverUploadError(error))) return;
      }
    }
  }

  private async waitForOriginRecovery(): Promise<boolean> {
    try {
      await this.options.waitUntilAvailable?.(this.availabilityAbort?.signal);
      return this.running;
    } catch (error) {
      // The availability owner stops before the engine drains during disposal.
      if (isHttpAbortError(error)) return this.running;
      throw error;
    }
  }

  private async recoverUploadError(error: unknown): Promise<boolean> {
    if (!this.running) return false;
    if (!this.online) return true;
    this.options.onError(error);
    this.pendingWake = false;
    if (
      error instanceof HttpNetworkError &&
      this.options.waitUntilAvailable !== undefined
    )
      return this.waitForOriginRecovery();
    this.errorAttempts += 1;
    await this.wait(this.errorBackoffMs(error));
    return this.running;
  }
}
