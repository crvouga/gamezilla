import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared/reconcile-postgres-schema';
import { freePostgresPort } from '@pkgs/postgres-embedded-server/free-port';
import { startEmbeddedPostgres } from '@pkgs/postgres-embedded-server/start';
import {
  createPgPool,
  openPgClient,
} from '@pkgs/sql-client-postgres-server/connect';
import { SqlClientImplBunPostgres } from '@pkgs/sql-client-postgres-server/impl-bun-postgres';
import { createPostgresDbScope } from '@pkgs/sql-client-shared/postgres-db-scope';
import { exampleAppSchema } from '@pkgs/sync-engine-harness/schema';
import { syncEngineServerSchema } from '@pkgs/sync-engine-shared/tables';

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
