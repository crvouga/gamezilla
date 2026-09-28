import { join } from 'node:path';
import { HARNESS_AUTH_SECRET } from '@libs/feature/public/harness-constants';
import { readUtf8 } from '@pkgs/object-store/helpers';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';

import type { HarnessComposition } from '../composition';

/** Repo-relative sources a seed is built from, read off disk by path. */
const HARNESS_MIGRATE = {
  dir: 'libs/harness/src/migrate',
  key: 'migrate-composition.ts',
} as const;
const AUTH_SCHEMA = {
  dir: 'pkgs/auth-inhouse/src/shared/schema',
  key: 'tables.ts',
} as const;

async function readSource(
  repoRoot: string,
  source: { readonly dir: string; readonly key: string }
): Promise<string> {
  const store = createNodeFsObjectStore({
    rootDir: join(repoRoot, source.dir),
    fs: wallNodeFs(),
    layout: 'tree',
  });
  const text = await readUtf8(store, source.key);
  if (text === null) {
    throw new Error(`missing seed source: ${source.dir}/${source.key}`);
  }
  return text;
}

/**
 * Inputs hashed into a composition's postgres seed fingerprint: its domain
 * schema, the migrate that applied it, and the IdP tables. A change to any of
 * them rebuilds the dump instead of opening a stale one. Seed rows
 * (`seedServer`) are inserted live per harness, not dumped.
 */
export async function harnessPostgresSeedFingerprintSource(
  repoRoot: string,
  composition: HarnessComposition
): Promise<Buffer> {
  const migrate =
    composition.migratePostgres === undefined
      ? await readSource(repoRoot, HARNESS_MIGRATE)
      : (composition.migrateFingerprint ?? '');
  return Buffer.from(
    [
      composition.name,
      JSON.stringify(composition.app.schema.snapshot()),
      migrate,
      HARNESS_AUTH_SECRET,
      await readSource(repoRoot, AUTH_SCHEMA),
    ].join('\n---\n')
  );
}
