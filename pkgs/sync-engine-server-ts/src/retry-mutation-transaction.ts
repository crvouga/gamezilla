import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { isTransientConflict } from '@pkgs/sql-client-root-shared-ts/transient-conflict';

const MAX_ATTEMPTS = 3;

/**
 * PostgreSQL serialization failures invalidate the transaction snapshot, so
 * replay the complete batch in a new transaction, never just its savepoint.
 * Mutation bodies already tolerate upload retries. Only confirmed conflicts
 * are retried: an unknown connection failure may have committed successfully.
 * Post-commit publication and listeners belong outside this boundary.
 */
export async function retryMutationTransaction<T>(
  db: SqlClient,
  body: (tx: SqlClient) => Promise<T>
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await db.transaction(body);
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isTransientConflict(error)) throw error;
    }
  }
}
