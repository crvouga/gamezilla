import { retryConflictingTransaction } from '@pkgs/sql-client-root-shared-ts/conflict-retry';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';

/**
 * PostgreSQL serialization failures invalidate the transaction snapshot, so
 * replay the complete batch in a new transaction, never just its savepoint.
 * Mutation bodies already tolerate upload retries. Only confirmed conflicts
 * are retried: an unknown connection failure may have committed successfully.
 * Post-commit publication and listeners belong outside this boundary. A host
 * whose client already retries conflicts with a backoff (`retryingConflicts`)
 * gets no second round of attempts here.
 */
export async function retryMutationTransaction<T>(
  db: SqlClient,
  body: (tx: SqlClient) => Promise<T>
): Promise<T> {
  return retryConflictingTransaction(db, body);
}
