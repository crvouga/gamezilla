import { KvImplPostgres } from '@pkgs/kv/impl-postgres';
import type { Kv } from '@pkgs/kv/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';

/**
 * Postgres-backed {@link Kv} for LLM response caching (Neon WebSocket per request).
 *
 * Does **not** run DDL. Call {@link KvImplPostgres.migrateUp} from your deploy /
 * `db:migrate` pipeline before serving traffic.
 */
export function createLlmPostgresKv(args: {
  readonly sqlClient: SqlClient;
  readonly now: () => number;
}): Kv {
  return new KvImplPostgres(args.sqlClient, args.now);
}
