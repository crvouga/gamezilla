// @io-wall-ok — harness sidecar adapter owns an isolated temporary Postgres cluster.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  freePostgresPort,
  startEmbeddedPostgres,
} from '@pkgs/postgres-embedded';
import { SqlClientImplAgnostic } from '@pkgs/sql-client/impl-agnostic';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import {
  createPgPool,
  ensurePostgresSchema,
} from '@pkgs/sql-client-postgres/connect';
import type { HarnessStore } from './store';

export async function openLiveStore(): Promise<HarnessStore> {
  const dataDir = mkdtempSync(join(tmpdir(), 'matchmaking-'));
  const pg = await startEmbeddedPostgres({
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
