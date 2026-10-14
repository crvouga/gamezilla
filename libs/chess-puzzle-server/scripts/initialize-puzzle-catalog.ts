// @io-wall-ok — deploy composition root: required puzzle reference data.
import { InitializePuzzleCatalog } from '@libs/chess-puzzle-server/initialize-puzzle-catalog';
import { chessPackageRootFromLoadFileModule } from '@libs/chess-puzzle-server/load-file';
import { resolveToolingDatabaseUrl } from '@libs/chess-puzzle-server/tooling-database-url';
import { appPostgresDbScope } from '@libs/db-shared/scope';
import { HttpPubSubFromSecretStore } from '@libs/pubsub-server/create-http-pubsub-from-secret-store';
import { refreshSecretsIntoEnv } from '@libs/secrets-server/secrets';
import { wallClock } from '@pkgs/clock-shared/wall';
import { createGlobalHttpClient } from '@pkgs/http-client-shared/global';
import { createLogger } from '@pkgs/logger-shared/logger';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs-server/repo-tree-store';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';
import { createScriptSecretStore } from '@pkgs/secret-store-shared/create-script-secret-store';
import { createPgPool } from '@pkgs/sql-client-postgres-server/connect';

const repoRoot = new URL('../../..', import.meta.url).pathname;
const logger = createLogger({ name: 'puzzle-catalog', now: wallClock.now });
await refreshSecretsIntoEnv();
const { databaseUrl } = await resolveToolingDatabaseUrl({
  configStore: createRepoTreeObjectStore({ rootDir: repoRoot }),
  http: createGlobalHttpClient(),
  repoRoot,
  surface: 'chess:initialize-catalog',
});
const pubsub = await new HttpPubSubFromSecretStore(
  createScriptSecretStore(),
  wallClock.now,
  createGlobalHttpClient()
).get();
if (pubsub === undefined)
  throw new Error('Puzzle catalog requires a publisher');

const { pool, sqlClient } = createPgPool({
  connectionString: databaseUrl,
  dbScope: appPostgresDbScope(),
  max: 1,
});
try {
  const summary = await new InitializePuzzleCatalog(sqlClient, {
    loadFileStore: createNodeFsObjectStore({
      rootDir: chessPackageRootFromLoadFileModule(),
      fs: wallNodeFs(),
      layout: 'tree',
    }),
    clock: wallClock,
    createId: () => crypto.randomUUID(),
    logger,
    pubsub,
  }).run();
  logger.info(
    summary === null ? 'existing catalog preserved' : 'initial catalog loaded',
    summary ?? {}
  );
} finally {
  await pool.end();
  await pubsub.close();
}
