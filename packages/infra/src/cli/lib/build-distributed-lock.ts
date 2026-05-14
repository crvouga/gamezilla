import { DistributedLockImplKv } from '@gamezilla/lib/distributed-lock/impl-kv';
import type { DistributedLock } from '@gamezilla/lib/distributed-lock/interface';
import { asKeyword } from '@gamezilla/lib/keyword';
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
 * and {@link DistributedLockImplKv}. The distributed lock KV key (namespaced
 * `prefix/local` keyword) is defined only here.
 */
export async function buildDistributedLock(): Promise<DistributedLockConnection> {
  const url = await resolveDatabaseUrl();
  const sql = new SqlClientImplPostgresTcp(url);
  await sql.connect();
  // Long CI deploys can leave the TCP session idle; a stuck `BEGIN` on release
  // would otherwise block the process forever (no stdin — not an interactive hang).
  // Sized to fit the in-process release inside GitHub Actions' ~7.5s
  // SIGTERM-to-SIGKILL grace window (see `RELEASE_TIMEOUT_MS` in
  // `run-infra-command.ts`): primary release must fail over to the recovery
  // connection well before SIGKILL. `lock_timeout` (2s) bounds how long we
  // wait on a row-level lock held by a peer; `statement_timeout` (4s) bounds
  // any single statement (e.g. a stuck transaction begin).
  try {
    await sql.run("SET statement_timeout = '4s'");
    await sql.run("SET lock_timeout = '2s'");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[infra lock] session timeouts not applied (${msg})`);
  }
  const kvLogger = createLogger({ name: 'infra-distributed-lock-kv' });
  const kv = await KvImplPostgres.open({ sqlClient: sql, logger: kvLogger });
  const lock = new DistributedLockImplKv(kv, {
    key: asKeyword('gamezilla.infra/distributed-lock'),
  });
  return {
    lock,
    disconnect: () => sql.disconnect(),
  };
}
