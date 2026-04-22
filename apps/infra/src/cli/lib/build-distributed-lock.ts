import { DistributedLockImplKv } from '@gamezilla/shared/distributed-lock/impl-kv';
import type { DistributedLock } from '@gamezilla/shared/distributed-lock/interface';
import { KvImplPostgres } from '@gamezilla/shared/kv/impl-postgres';
import { SqlClientImplPostgresTcp } from '@gamezilla/shared/sql-client/impl-postgres-tcp';
import { resolveDatabaseUrl } from '../resources/planetscale-postgres';

export interface DistributedLockConnection {
  readonly lock: DistributedLock;
  /** Closes the Bun `SQL` connection. Call in `finally`. */
  disconnect(): Promise<void>;
}

/**
 * Wires PlanetScale Postgres over Bun's native TCP `SQL` driver, {@link KvImplPostgres},
 * and {@link DistributedLockImplKv}. The lock key `infra` is defined only here.
 */
export async function buildDistributedLock(): Promise<DistributedLockConnection> {
  const url = await resolveDatabaseUrl();
  const sql = new SqlClientImplPostgresTcp(url);
  await sql.connect();
  const kv = await KvImplPostgres.open(sql);
  const lock = new DistributedLockImplKv(kv, { key: 'infra' });
  return {
    lock,
    disconnect: () => sql.disconnect(),
  };
}
