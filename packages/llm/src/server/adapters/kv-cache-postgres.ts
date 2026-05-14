import { KvImplPostgres } from '@gamezilla/lib/kv/impl-postgres';
import type { Kv } from '@gamezilla/lib/kv/interface';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';

/**
 * Postgres-backed {@link Kv} for LLM response caching (Hyperdrive TCP).
 *
 * Does **not** run DDL. Call {@link KvImplPostgres.migrateUp} from your deploy /
 * `db:migrate` pipeline before serving traffic.
 */
export function createLlmPostgresKv(args: {
  readonly sqlClient: SqlClient;
}): Kv {
  return new KvImplPostgres(args.sqlClient);
}
