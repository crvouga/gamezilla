import { GlobalLockImplKv } from '@gamezilla/shared/global-lock/impl-kv';
import type { GlobalLock } from '@gamezilla/shared/global-lock/interface';
import { KvImplPostgres } from '@gamezilla/shared/kv/impl-postgres';
import { SqlClientImplPlanetScalePostgresWs } from '@gamezilla/shared/sql-client/impl-planetscale-postgres-ws';
import { resolveDatabaseUrl } from '../resources/planetscale-postgres';

export interface GlobalLockConnection {
  readonly lock: GlobalLock;
  /** Close the underlying WebSocket {@link SqlClient}. Call in `finally`. */
  disconnect(): Promise<void>;
}

/**
 * Wires PlanetScale + Neon WebSocket {@link SqlClient}, {@link KvImplPostgres},
 * and {@link GlobalLockImplKv} for the infra CLI. The lock key `infra` is
 * defined only here.
 */
export async function buildGlobalLock(): Promise<GlobalLockConnection> {
  const url = await resolveDatabaseUrl();
  const sql = new SqlClientImplPlanetScalePostgresWs(url);
  await sql.connect();
  const kv = await KvImplPostgres.open(sql);
  const lock = new GlobalLockImplKv(kv, { key: 'infra' });
  return {
    lock,
    disconnect: () => sql.disconnect(),
  };
}
