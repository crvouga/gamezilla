import { join } from 'node:path';
import { SIM_AUTH_SECRET } from '@libs/server-app/sim/migrate-sim-postgres';
import { readUtf8 } from '@pkgs/object-store/helpers';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';

const MIGRATE_SOURCE_KEY = 'migrate-sim-postgres.ts';

const AUTH_SCHEMA_TABLES_KEY = 'tables.ts';

const DOMAIN_SCHEMA_KEY = 'schema-snapshot.json';

function createMigrateSourceStore(repoRoot: string) {
  return createNodeFsObjectStore({
    rootDir: join(repoRoot, 'libs/server-app/src/sim'),
    fs: wallNodeFs(),
    layout: 'tree',
  });
}

function createAuthSchemaStore(repoRoot: string) {
  return createNodeFsObjectStore({
    rootDir: join(repoRoot, 'pkgs/auth/src/shared/schema'),
    fs: wallNodeFs(),
    layout: 'tree',
  });
}

function createDomainSchemaStore(repoRoot: string) {
  return createNodeFsObjectStore({
    rootDir: join(repoRoot, 'libs/runtime'),
    fs: wallNodeFs(),
    layout: 'tree',
  });
}

/**
 * Inputs hashed into postgres sim seed fingerprints. Include IdP schema so
 * new `defineTable` auth migrations invalidate stale PGMM seeds.
 * Chess DST puzzles are live-inserted in openSim (not in this dump).
 */
export async function simPostgresSeedFingerprintSource(
  repoRoot: string
): Promise<Buffer> {
  const migrateStore = createMigrateSourceStore(repoRoot);
  const migrate = await readUtf8(migrateStore, MIGRATE_SOURCE_KEY);
  if (migrate === null) {
    throw new Error(`missing migrate source: ${MIGRATE_SOURCE_KEY}`);
  }
  const authStore = createAuthSchemaStore(repoRoot);
  const authTables = await readUtf8(authStore, AUTH_SCHEMA_TABLES_KEY);
  if (authTables === null) {
    throw new Error(`missing auth schema: ${AUTH_SCHEMA_TABLES_KEY}`);
  }
  const domainStore = createDomainSchemaStore(repoRoot);
  const domainSchema = await readUtf8(domainStore, DOMAIN_SCHEMA_KEY);
  if (domainSchema === null) {
    throw new Error(`missing domain schema: ${DOMAIN_SCHEMA_KEY}`);
  }
  return Buffer.from(
    [migrate, SIM_AUTH_SECRET, authTables, domainSchema].join('\n---\n')
  );
}
