import type { Clock } from '@pkgs/clock-shared-ts/types';
import { reconcileFeedbackPostgres } from '@pkgs/feedback-server-ts/reconcile';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server-ts/impl-mockingbird-postgres';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';

/** The bug report queue on in-memory Postgres, as `bun db:migrate` declares it. */
export async function openQueue(clock: Clock): Promise<SqlClient> {
  const db = SqlClientImplMockingbirdPostgres.open({
    seed: 1,
    now: () => new Date(clock.now()),
  });
  await db.connect();
  await reconcileFeedbackPostgres(db);
  return db;
}
