// @io-wall-ok
/**
 * Repo-root ObjectStore for CI / tooling scripts — tree layout over the
 * working tree with common build dirs skipped.
 */
import { join } from 'node:path';

import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import { createNodeFsObjectStore } from './impl-node-fs';
import { wallNodeFs } from './wall-node-fs';

export const REPO_TREE_SKIP_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  '.git',
  '.turbo',
  'coverage',
  '.wrangler',
  'ios',
  'android',
  'data',
]);

export type CreateRepoTreeObjectStoreArgs = {
  readonly rootDir: string;
  readonly skipDirNames?: ReadonlySet<string>;
};

/** Tree-layout ObjectStore rooted at `rootDir` (typically the monorepo root). */
export function createRepoTreeObjectStore(
  args: CreateRepoTreeObjectStoreArgs
): ObjectStore {
  return createNodeFsObjectStore({
    rootDir: args.rootDir,
    fs: wallNodeFs(),
    layout: 'tree',
    skipDirNames: args.skipDirNames ?? REPO_TREE_SKIP_DIRS,
  });
}

/** Convenience when the script lives under `libs/tools/scripts/`. */
export function createRepoTreeObjectStoreFromScriptsDir(
  scriptsDirname: string
): ObjectStore {
  return createRepoTreeObjectStore({
    rootDir: join(scriptsDirname, '../..'),
  });
}
