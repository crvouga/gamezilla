// @io-wall-ok
/** Seed the required puzzle baseline after schema reconcile in every deploy. */
import { join } from 'node:path';
import { ChessPuzzleLoadFileSeeder } from '@libs/chess/root/server/seed-chess-puzzles/chess-puzzle-load-file-seeder';
import { resolveToolingDatabaseUrl } from '@libs/chess/root/server/seed-chess-puzzles/tooling-database-url';
import { assert } from '@pkgs/assert';
import { wallClock } from '@pkgs/clock';
import { createGlobalHttpClient } from '@pkgs/http-client';
import { createLogger } from '@pkgs/logger';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs/repo-tree-store';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { openPgClient } from '@pkgs/sql-client-postgres/connect';

const CHESS_PACKAGE_ROOT = join(import.meta.dirname, '..');
const REPO_ROOT = join(import.meta.dirname, '../../..');

async function seedDeployChessPuzzles(): Promise<void> {
  const logger = createLogger({
    name: 'chess:seed-deploy-puzzles',
    now: wallClock.now,
  });
  const { databaseUrl, env } = await resolveToolingDatabaseUrl({
    configStore: createRepoTreeObjectStore({ rootDir: REPO_ROOT }),
    http: createGlobalHttpClient(),
    repoRoot: REPO_ROOT,
    surface: 'chess:seed-deploy-puzzles',
  });
  const { sqlClient } = await openPgClient({
    connectionString: databaseUrl,
    dbScope: createPostgresDbScope('public'),
    clientOptions: { application_name: 'seed:deploy-puzzles' },
  });
  try {
    await new ChessPuzzleLoadFileSeeder({
      loadFileStore: createRepoTreeObjectStore({
        rootDir: CHESS_PACKAGE_ROOT,
      }),
      createId: () => crypto.randomUUID(),
      now: wallClock.now,
    }).seed({ sqlClient, logger });
    logger.info('deploy puzzle baseline ready', { secretsEnv: env.env });
  } finally {
    await sqlClient.disconnect();
  }
}

await seedDeployChessPuzzles().catch((error: unknown) => {
  assert.fail('seed:deploy chess puzzles failed', { error });
});
