import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { TableChangeBus } from '../queries/client/table-change-bus';

import { REAL_TIMERS, resolveNow, type Timers } from './sim-ports';
import { recordTopicApplied } from './topic-applied';

const BATCH_LIMIT = 64;
/** Fallback poll when nothing is pending; wakes interrupt this wait. */
const IDLE_DELAY_MS = 100;
const ERROR_DELAY_MS = 2_000;

export type MutationUploadRow = {
  readonly id: string;
  readonly name: string;
  readonly args: string;
  readonly clientId: string;
  readonly seq: number;
  readonly createdAt: string;
};

export type MutationUploadVerdict =
  | { readonly mutationId: string; readonly status: 'applied' }
  | {
      readonly mutationId: string;
      readonly status: 'rejected';
      readonly code: string;
      readonly message: string;
    };

export type MutationUploadResult = {
  readonly ok: true;
  readonly verdicts: readonly MutationUploadVerdict[];
  readonly ackSeq: number;
  /**
   * Per-topic checkpoints assigned for this batch's nudges. The mutating
   * client floors `_topic_applied` so its own echoed fanout is ignored.
   */
  readonly topicCheckpoints?: Readonly<Record<string, string>>;
};

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
  readonly onUploaded?: (() => void) | undefined;
  readonly timers?: Timers;
  readonly now?: () => number;
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
    FROM _mutations
    WHERE client_id = ${clientId}
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
  await tx.run(sql`
    INSERT INTO write_rejections (
      id, mutation_id, client_id, code, message, meta, created_at, acknowledged
    )
    VALUES (
      ${`local:${verdict.mutationId}`},
      ${verdict.mutationId},
      ${clientId},
      ${verdict.code},
      ${verdict.message},
      ${null},
      ${createdAt},
      ${0}
    )
    ON CONFLICT (id) DO UPDATE SET
      code = excluded.code,
      message = excluded.message
  `);
}

async function applyUploadResult(
  options: MutationUploadQueueOptions,
  result: MutationUploadResult,
  now: () => number
): Promise<void> {
  const clientId = options.clientId();
  const createdAt = new Date(now()).toISOString();
  await options.db.transaction(async (tx) => {
    for (const verdict of result.verdicts) {
      if (verdict.status === 'rejected') {
        await storeRejection(tx, clientId, verdict, createdAt);
      }
      await tx.run(sql`
        DELETE FROM _mutations WHERE id = ${verdict.mutationId}
      `);
    }
  });
  // Floor topic checkpoints from the ack so own echoed fanout is a no-op.
  if (result.topicCheckpoints !== undefined) {
    for (const [topic, checkpoint] of Object.entries(result.topicCheckpoints)) {
      await recordTopicApplied(options.db, topic, checkpoint);
    }
  }
  options.bus.emit(['_mutations', 'write_rejections']);
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
  private readonly timers: Timers;
  private readonly now: () => number;

  constructor(private readonly options: MutationUploadQueueOptions) {
    this.timers = options.timers ?? REAL_TIMERS;
    this.now = resolveNow(options.now);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.loopPromise = this.runLoop();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.pendingWake = true;
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

  private async drainOnce(): Promise<boolean> {
    const pending = await readPending(this.options.db, this.options.clientId());
    if (pending.length === 0) return false;
    const result = await this.options.postBatch(pending.map(toWireRow));
    await applyUploadResult(this.options, result, this.now);
    this.options.onUploaded?.();
    return true;
  }

  private async runLoop(): Promise<void> {
    while (this.running) {
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
        this.options.onError(error);
        // Keep the 2s error backoff: discard sticky wakes from the failed
        // attempt. A fresh wake() during the wait still interrupts.
        this.pendingWake = false;
        await this.wait(ERROR_DELAY_MS);
      }
    }
  }
}
