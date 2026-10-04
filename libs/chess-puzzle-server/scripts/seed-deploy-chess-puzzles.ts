// @io-wall-ok
/** Seed the required puzzle baseline after schema reconcile in every deploy. */
import { join } from 'node:path';
import { ChessPuzzleLoadFileSeeder } from '@libs/chess-puzzle-server/chess-puzzle-load-file-seeder';
import { resolveToolingDatabaseUrl } from '@libs/chess-puzzle-server/tooling-database-url';
import { assert } from '@pkgs/assert-shared/singleton';
import { wallClock } from '@pkgs/clock-shared/wall';
import { createGlobalHttpClient } from '@pkgs/http-client-shared/global';
import { createLogger } from '@pkgs/logger-shared/logger';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs-server/repo-tree-store';
import { openPgClient } from '@pkgs/sql-client-postgres-server/connect';
import { createPostgresDbScope } from '@pkgs/sql-client-shared/postgres-db-scope';

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
