import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { raw } from '@pkgs/sql-root-shared/sql';

/** Each replay can roll back its own writes while the enclosing batch continues. */
export function mutationSavepointClient(tx: SqlClient): SqlClient {
  return {
    connect: () => tx.connect(),
    disconnect: () => Promise.resolve(),
    query: (q) => tx.query(q),
    run: (q) => tx.run(q),
    prepare: (q) => tx.prepare(q),
    transaction: async (body) => {
      await tx.run(raw('SAVEPOINT sync_engine_mutation'));
      try {
        const result = await body(tx);
        await tx.run(raw('RELEASE SAVEPOINT sync_engine_mutation'));
        return result;
      } catch (error) {
        await tx.run(raw('ROLLBACK TO SAVEPOINT sync_engine_mutation'));
        await tx.run(raw('RELEASE SAVEPOINT sync_engine_mutation'));
        throw error;
      }
    },
  };
}
