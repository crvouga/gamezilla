import { DistributedLockImplKv } from '@gamezilla/lib/distributed-lock/impl-kv';
import type { DistributedLock } from '@gamezilla/lib/distributed-lock/interface';
import { KvImplPostgres } from '@gamezilla/lib/kv/impl-postgres';
import { createLogger } from '@gamezilla/lib/logger';
import { SqlClientImplPostgresTcp } from '@gamezilla/lib/sql-client/impl-postgres-tcp';
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
  // Long CI deploys can leave the TCP session idle; a stuck `BEGIN` on release
  // would otherwise block the process forever (no stdin — not an interactive hang).
  try {
    await sql.run("SET statement_timeout = '15s'");
    await sql.run("SET lock_timeout = '8s'");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[infra lock] session timeouts not applied (${msg})`);
  }
  const kvLogger = createLogger({ name: 'infra-distributed-lock-kv' });
  const kv = await KvImplPostgres.open({ sqlClient: sql, logger: kvLogger });
  const lock = new DistributedLockImplKv(kv, { key: 'infra' });
  return {
    lock,
    disconnect: () => sql.disconnect(),
  };
}
