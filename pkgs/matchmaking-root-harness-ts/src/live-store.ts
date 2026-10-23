// @io-wall-ok — harness sidecar adapter owns an isolated temporary Postgres cluster.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freePostgresPort } from '@pkgs/postgres-mockingbird-server-ts/free-port';
import { startMockingbirdPostgres } from '@pkgs/postgres-mockingbird-server-ts/start';
import { createPgPool } from '@pkgs/sql-client-postgres-server-ts/connect';
import { ensurePostgresSchema } from '@pkgs/sql-client-postgres-shared-ts/ensure-schema';
import { SqlClientImplAgnostic } from '@pkgs/sql-client-root-shared-ts/impl-agnostic';
import { createPostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import type { HarnessStore } from './store';

export async function openLiveStore(): Promise<HarnessStore> {
  const dataDir = mkdtempSync(join(tmpdir(), 'matchmaking-'));
  const pg = await startMockingbirdPostgres({
    port: await freePostgresPort(),
    dataDir,
  });
  const dbScope = createPostgresDbScope('example_lobby');
  const { pool, sqlClient } = createPgPool({
    connectionString: pg.url,
    dbScope,
    max: 6,
  });
  const close = async () => {
    try {
      await pool.end();
    } finally {
      try {
        await pg.stop();
      } finally {
        rmSync(dataDir, { recursive: true, force: true });
      }
    }
  };
  try {
    await ensurePostgresSchema(sqlClient, dbScope);
    await sqlClient.connect();
    const shared = new SqlClientImplAgnostic(sqlClient);
    return { backend: 'postgres-live', openClient: () => shared, close };
  } catch (error) {
    await close();
    throw error;
  }
}
