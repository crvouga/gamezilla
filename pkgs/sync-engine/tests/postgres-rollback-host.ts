import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres';
import {
  freePostgresPort,
  startEmbeddedPostgres,
} from '@pkgs/postgres-embedded';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { createPgPool, openPgClient } from '@pkgs/sql-client-postgres/connect';
import { SqlClientImplBunPostgres } from '@pkgs/sql-client-postgres/impl-bun-postgres';
import { exampleAppSchema } from '@pkgs/sync-engine/harness';
import { syncEngineServerSchema } from '@pkgs/sync-engine/server';

export async function openRollbackHost(driver: 'pool' | 'session' | 'bun') {
  const dataDir = mkdtempSync(join(tmpdir(), 'note-rollback-'));
  const pg = await startEmbeddedPostgres({
    port: await freePostgresPort(),
    dataDir,
  });
  const dbScope = createPostgresDbScope('note_rollback');
  const { pool, sqlClient: admin } = createPgPool({
    connectionString: pg.url,
    dbScope,
  });
  let closeDriver = () => Promise.resolve();
  const dispose = async () => {
    try {
      await closeDriver();
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
    for (const schema of [syncEngineServerSchema, exampleAppSchema])
      await reconcilePostgresSchema(admin, schema, dbScope);
    const session =
      driver === 'session'
        ? await openPgClient({ connectionString: pg.url, dbScope })
        : null;
    const db =
      driver === 'bun'
        ? SqlClientImplBunPostgres.connect(pg.url, dbScope)
        : (session?.sqlClient ?? admin);
    closeDriver =
      session === null
        ? driver === 'bun'
          ? () => db.disconnect()
          : () => Promise.resolve()
        : () => session.client.end();
    return {
      db,
      async [Symbol.asyncDispose]() {
        await dispose();
      },
    };
  } catch (error) {
    await dispose();
    throw error;
  }
}
