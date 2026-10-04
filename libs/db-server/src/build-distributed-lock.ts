import { appPostgresDbScope } from '@libs/db-shared/scope';
import { DefaultLockIdentityProvider } from '@pkgs/distributed-lock-server/default-lock-identity-provider';
import { DistributedLockImplKv } from '@pkgs/distributed-lock-shared/impl-kv';
import type { DistributedLock } from '@pkgs/distributed-lock-shared/interface';
import { asKeyword } from '@pkgs/keyword-shared/keyword';
import { KvImplPostgres } from '@pkgs/kv-postgres-shared/impl-postgres';
import { createLogger } from '@pkgs/logger-shared/logger';
import { raw } from '@pkgs/sql-shared/sql';
import { SqlClientImplBunPostgres as SqlClientImplPostgresTcp } from '@pkgs/sql-client-postgres-server/impl-bun-postgres';
import { cliClock, cliCreateId } from '@libs/db-shared/cli-io';
import { resolveDatabaseUrl } from './postgres-ping-source';

export interface DistributedLockConnection {
  readonly lock: DistributedLock;
  /** Closes the Bun `SQL` connection. Call in `finally`. */
  disconnect(): Promise<void>;
}

/**
 * Wires Neon Postgres over Bun's native TCP `SQL` driver, {@link KvImplPostgres},
 * and {@link DistributedLockImplKv}. The distributed lock KV key (namespaced
 * `prefix/local` keyword) is defined only here.
 */
export async function buildDistributedLock(): Promise<DistributedLockConnection> {
  const url = await resolveDatabaseUrl();
  const sql = new SqlClientImplPostgresTcp(url, appPostgresDbScope());
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
    await sql.run(raw("SET statement_timeout = '4s'"));
    await sql.run(raw("SET lock_timeout = '2s'"));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[infra lock] session timeouts not applied (${msg})`);
  }
  const kvLogger = createLogger({
    name: 'infra-distributed-lock-kv',
    now: cliClock.now,
  });
  const kv = await KvImplPostgres.open({
    sqlClient: sql,
    logger: kvLogger,
    now: cliClock.now,
  });
  const lock = new DistributedLockImplKv(kv, {
    key: asKeyword('infra/distributed-lock'),
    identity: new DefaultLockIdentityProvider({
      now: cliClock.now,
      createId: cliCreateId,
    }),
  });
  return {
    lock,
    disconnect: () => sql.disconnect(),
  };
}
