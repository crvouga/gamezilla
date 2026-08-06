import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { TableChangeBus } from '@pkgs/queries/client/table-change-bus';

const BATCH_LIMIT = 64;
const IDLE_DELAY_MS = 750;
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
  verdict: Extract<MutationUploadVerdict, { status: 'rejected' }>
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
      ${new Date().toISOString()},
      ${0}
    )
    ON CONFLICT (id) DO UPDATE SET
      code = excluded.code,
      message = excluded.message
  `);
}

async function applyUploadResult(
  options: MutationUploadQueueOptions,
  result: MutationUploadResult
): Promise<void> {
  const clientId = options.clientId();
  await options.db.transaction(async (tx) => {
    for (const verdict of result.verdicts) {
      if (verdict.status === 'rejected') {
        await storeRejection(tx, clientId, verdict);
      }
    }
    await tx.run(sql`
      UPDATE _upload_state
      SET last_acked_seq = MAX(last_acked_seq, ${result.ackSeq}),
          handoff_complete = ${1}
      WHERE id = ${'singleton'}
    `);
    await tx.run(sql`
      DELETE FROM _mutations
      WHERE client_id = ${clientId} AND seq <= ${result.ackSeq}
    `);
  });
  options.bus.emit(['_mutations', '_upload_state', 'write_rejections']);
}

/** Polling durable mutation uploader with ordered ack-watermark deletion. */
export class MutationUploadQueue {
  private running = false;
  private loopPromise: Promise<void> | null = null;
  private wakeWaiter: (() => void) | null = null;

  constructor(private readonly options: MutationUploadQueueOptions) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.loopPromise = this.runLoop();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.wakeWaiter?.();
    await this.loopPromise;
    this.loopPromise = null;
  }

  wake(): void {
    this.wakeWaiter?.();
  }

  private async wait(ms: number): Promise<void> {
    if (!this.running) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.wakeWaiter = null;
        resolve();
      }, ms);
      this.wakeWaiter = () => {
        clearTimeout(timer);
        this.wakeWaiter = null;
        resolve();
      };
    });
  }

  private async drainOnce(): Promise<boolean> {
    const pending = await readPending(this.options.db, this.options.clientId());
    if (pending.length === 0) return false;
    const result = await this.options.postBatch(pending.map(toWireRow));
    await applyUploadResult(this.options, result);
    this.options.onUploaded?.();
    return true;
  }

  private async runLoop(): Promise<void> {
    while (this.running) {
      try {
        const uploaded = await this.drainOnce();
        if (!uploaded) await this.wait(IDLE_DELAY_MS);
      } catch (error) {
        this.options.onError(error);
        await this.wait(ERROR_DELAY_MS);
      }
    }
  }
}
