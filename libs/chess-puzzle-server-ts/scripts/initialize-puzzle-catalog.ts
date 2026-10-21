// @io-wall-ok — deploy composition root: required puzzle reference data.
import { InitializePuzzleCatalog } from '@libs/chess-puzzle-server-ts/initialize-puzzle-catalog';
import { chessPackageRootFromLoadFileModule } from '@libs/chess-puzzle-server-ts/load-file';
import { resolveToolingDatabaseUrl } from '@libs/chess-puzzle-server-ts/tooling-database-url';
import { appPostgresDbScope } from '@libs/db-shared-ts/scope';
import { HttpPubSubFromSecretStore } from '@libs/pubsub-server-ts/create-http-pubsub-from-secret-store';
import { refreshSecretsIntoEnv } from '@libs/secrets-server-ts/secrets';
import { wallClock } from '@pkgs/clock-shared-ts/wall';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs-server-ts/repo-tree-store';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import { createScriptSecretStore } from '@pkgs/secret-store-shared-ts/create-script-secret-store';
import { createPgPool } from '@pkgs/sql-client-postgres-server-ts/connect';

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
