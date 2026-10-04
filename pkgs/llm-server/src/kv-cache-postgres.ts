import type { Kv } from '@pkgs/kv-shared/interface';
import { KvImplPostgres } from '@pkgs/kv-postgres-shared/impl-postgres';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';

/**
 * Postgres-backed {@link Kv} for LLM response caching (Neon WebSocket per request).
 *
 * Does **not** run DDL. Call {@link KvImplPostgres.reconcile} from your deploy /
 * `db:migrate` pipeline before serving traffic.
 */
export function createLlmPostgresKv(args: {
  readonly sqlClient: SqlClient;
  readonly now: () => number;
}): Kv {
  return new KvImplPostgres(args.sqlClient, args.now);
}
