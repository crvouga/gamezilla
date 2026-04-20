import { GlobalLockImplKv } from '@gamezilla/shared/global-lock/impl-kv';
import type { GlobalLock } from '@gamezilla/shared/global-lock/interface';
import { KvImplPostgres } from '@gamezilla/shared/kv/impl-postgres';
import { SqlClientImplPostgresTcp } from '@gamezilla/shared/sql-client/impl-postgres-tcp';
import { resolveDatabaseUrl } from '../resources/planetscale-postgres';

export interface GlobalLockConnection {
  readonly lock: GlobalLock;
  /** Closes the Bun `SQL` connection. Call in `finally`. */
  disconnect(): Promise<void>;
}

/**
 * Wires PlanetScale Postgres over Bun's native TCP `SQL` driver, {@link KvImplPostgres},
 * and {@link GlobalLockImplKv}. The lock key `infra` is defined only here.
 */
export async function buildGlobalLock(): Promise<GlobalLockConnection> {
  const url = await resolveDatabaseUrl();
  const sql = new SqlClientImplPostgresTcp(url);
  await sql.connect();
  const kv = await KvImplPostgres.open(sql);
  const lock = new GlobalLockImplKv(kv, { key: 'infra' });
  return {
    lock,
    disconnect: () => sql.disconnect(),
  };
}
