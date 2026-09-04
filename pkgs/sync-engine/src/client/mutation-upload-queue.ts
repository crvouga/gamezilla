import { assert } from '@pkgs/assert';
import { HttpNetworkError } from '@pkgs/http-client';
import { join, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { clearOptimisticRowsForMutation } from '../mutations/client/optimistic-own-rows';
import type {
  MutationBatchResponse,
  MutationRequestItem,
  MutationVerdict,
} from '../protocol';
import type { TableChangeBus } from '../queries/client/table-change-bus';
import { MAX_MUTATIONS_BATCH } from '../queries/shared/bounds';
import { recordPushApplied } from './push-applied';
import type { Timers } from './sim-ports';
import { parseRateLimitRetryMs } from './sync-http-rate-limit-error';

const BATCH_LIMIT = MAX_MUTATIONS_BATCH;
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
  readonly timers: Timers;
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
  };
}

async function readPending(
  db: SqlClient,
  clientId: string
): Promise<readonly StoredMutation[]> {
  return db.query(sql<StoredMutation>`
    SELECT id, name, args, client_id, seq, created_at
    FROM sync_engine_mutations
    WHERE client_id = ${clientId}
      AND deleted_at IS NULL
    ORDER BY seq ASC
    LIMIT ${BATCH_LIMIT}
  `);
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
      ${null},
      ${createdAt},
      ${createdAt},
      ${null},
      ${0}
    )
    ON CONFLICT (id) DO UPDATE SET
      code = excluded.code,
      message = excluded.message,
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
}

/**
 * Resolve `work` unless `signal` aborts first. Orphan the in-flight promise so
 * disconnect / cache-clear is not blocked on partitioned HTTP (sim RPC waits
 * on scheduler time that is not advancing).
 */
function raceUntilAborted<T>(
  work: Promise<T>,
  signal: AbortSignal | null
): Promise<T | null> {
  if (signal?.aborted === true) {
    void work.then(
      () => undefined,
      () => undefined
    );
    return Promise.resolve(null);
  }
  if (signal === null) return work;
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      resolve(null);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    void work.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(signal.aborted ? null : value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        if (signal.aborted) resolve(null);
        else reject(error);
      }
    );
  });
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
    this.loopPromise = this.runLoop();
  }

  async stop(): Promise<void> {
    this.running = false;
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

  private async drainOnce(): Promise<boolean> {
    const pending = await readPending(this.options.db, this.options.clientId());
    assert.ok(
      pending.length <= BATCH_LIMIT,
      'pending mutation batch read bound'
    );
    if (!this.running || pending.length === 0) return false;
    await this.options.waitUntilAvailable?.(this.availabilityAbort?.signal);
    if (!this.running) return false;
    const result = await raceUntilAborted(
      this.options.postBatch(pending.map(toWireRow)),
      this.availabilityAbort?.signal ?? null
    );
    if (result === null || !this.running) return false;
    await applyUploadResult(this.options, pending, result, this.now);
    this.errorAttempts = 0;
    return true;
  }

  private async runLoop(): Promise<void> {
    // Event loop: terminates when `stop()` clears `running`.
    while (this.running) {
      assert.ok(this.running, 'upload queue event loop');
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
        if (!this.running) return;
        this.options.onError(error);
        this.pendingWake = false;
        if (
          error instanceof HttpNetworkError &&
          this.options.waitUntilAvailable !== undefined
        ) {
          await this.options.waitUntilAvailable(this.availabilityAbort?.signal);
          continue;
        }
        this.errorAttempts += 1;
        await this.wait(this.errorBackoffMs(error));
      }
    }
  }
}
