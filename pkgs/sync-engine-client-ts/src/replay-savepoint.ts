import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import { raw } from '@pkgs/sql-root-shared-ts/sql';
import { isMutationError } from '@pkgs/sync-engine-shared-ts/failures';

type Replay = (db: SqlTx) => Promise<void>;

/** Bound how much SQL an offline backlog retains for rollback of a refused write. */
const MAX_REDO_STATEMENTS = 128;

/**
 * Run each body once. A savepoint covers several successful writes. If a
 * body refuses, rewind to the savepoint and restore the successful prefix
 * from the SQL and bindings it already issued (including generated IDs).
 */
export async function replayWithSavepoints(
  tx: SqlTx,
  writes: readonly Replay[]
): Promise<void> {
  const redo: Array<() => Promise<unknown>> = [];
  const record: SqlTx = {
    async query(q) {
      const rows = await tx.query(q);
      redo.push(() => tx.query(q));
      return rows;
    },
    async run(q) {
      const result = await tx.run(q);
      redo.push(() => tx.run(q));
      return result;
    },
  };
  let open = false;
  for (const write of writes) {
    if (!open) {
      await tx.run(raw('SAVEPOINT sync_engine_rebase'));
      open = true;
    }
    const start = redo.length;
    let refused = false;
    try {
      await write(record);
    } catch (error) {
      if (!isMutationError(error)) throw error;
      await tx.run(raw('ROLLBACK TO SAVEPOINT sync_engine_rebase'));
      redo.length = start;
      for (const statement of redo) await statement();
      refused = true;
    }
    if (refused || redo.length >= MAX_REDO_STATEMENTS) {
      await tx.run(raw('RELEASE SAVEPOINT sync_engine_rebase'));
      open = false;
      redo.length = 0;
    }
  }
  if (open) await tx.run(raw('RELEASE SAVEPOINT sync_engine_rebase'));
}
