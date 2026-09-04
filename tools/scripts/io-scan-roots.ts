// @io-wall-ok — tools composition root (repo tree ObjectStore for CI scans)
/**
 * Shared filesystem roots for deterministic-I/O CI gates.
 * Walks via injected {@link ObjectStore} tree layout — no direct `node:fs`.
 */
import { join } from 'node:path';
import type { ObjectStore } from '../../pkgs/object-store/src/interface';
import {
  createRepoTreeObjectStore,
  REPO_TREE_SKIP_DIRS,
} from '../../pkgs/object-store/src/repo-tree-store';

export const REPO_ROOT = join(import.meta.dirname, '../..');

export { REPO_TREE_SKIP_DIRS as SKIP_DIR };

const TS_EXTS = ['.ts', '.tsx'] as const;
const TS_JS_EXTS = ['.ts', '.tsx', '.js', '.cjs', '.mjs'] as const;
const TS_SQL_EXTS = ['.ts', '.tsx', '.sql'] as const;

function hasExt(key: string, exts: readonly string[]): boolean {
  if (key.endsWith('.d.ts')) return false;
  return exts.some((ext) => key.endsWith(ext));
}

function underPrefix(key: string, prefix: string): boolean {
  return key === prefix || key.startsWith(`${prefix}/`);
}

async function keysUnder(
  store: ObjectStore,
  prefix: string,
  exts: readonly string[]
): Promise<string[]> {
  const keys = await store.listKeys(
    prefix.length > 0 ? `${prefix}/` : undefined
  );
  return keys.filter((k) => underPrefix(k, prefix) && hasExt(k, exts));
}

function toAbs(relKeys: readonly string[]): string[] {
  return relKeys.map((k) => join(REPO_ROOT, k));
}

/** Shared repo-tree ObjectStore for CI scanners. */
export function createCiRepoStore(): ObjectStore {
  return createRepoTreeObjectStore({ rootDir: REPO_ROOT });
}

/** Product + tooling TS/TSX/JS scanned by bare-io / resolve-wall / bare-fs gates. */
export async function collectIoScanFiles(
  store: ObjectStore = createCiRepoStore()
): Promise<string[]> {
  const files: string[] = [];

  for (const app of [
    'client',
    'api',
    'postgres',
    'room',
    'minio',
    'emqx',
  ] as const) {
    files.push(
      ...(await keysUnder(store, `apps/${app}/src`, TS_JS_EXTS)),
      ...(await keysUnder(store, `apps/${app}/scripts`, TS_EXTS)),
      ...(await keysUnder(store, `apps/${app}/public`, TS_JS_EXTS))
    );
  }

  const allKeys = await store.listKeys();
  for (const key of allKeys) {
    if (key.startsWith('libs/') && hasExt(key, TS_EXTS)) {
      if (
        /\/src\//.test(key) ||
        /\/scripts\//.test(key) ||
        /\/tests\//.test(key) ||
        /\/e2e\//.test(key)
      ) {
        files.push(key);
      }
    }
    if (key.startsWith('pkgs/') && hasExt(key, TS_JS_EXTS)) {
      if (
        /\/src\//.test(key) ||
        /\/scripts\//.test(key) ||
        /\/tests\//.test(key) ||
        /\/db\//.test(key) ||
        /\/e2e\//.test(key)
      ) {
        files.push(key);
      }
    }
    if (key.startsWith('sim/') && hasExt(key, TS_JS_EXTS)) {
      if (
        /\/src\//.test(key) ||
        /\/scripts\//.test(key) ||
        /\/tests\//.test(key)
      ) {
        files.push(key);
      }
    }
  }

  files.push(...(await keysUnder(store, 'tools', TS_EXTS)));

  return [...new Set(toAbs(files))].sort();
}

/** TS/TSX/SQL scanned by the SQL wall-I/O gate. */
export async function collectSqlWallScanFiles(
  store: ObjectStore = createCiRepoStore()
): Promise<string[]> {
  const files: string[] = [];
  for (const app of [
    'client',
    'api',
    'postgres',
    'room',
    'minio',
    'emqx',
  ] as const) {
    files.push(...(await keysUnder(store, `apps/${app}`, TS_SQL_EXTS)));
  }
  const allKeys = await store.listKeys();
  for (const key of allKeys) {
    if (
      (key.startsWith('libs/') ||
        key.startsWith('pkgs/') ||
        key.startsWith('sim/')) &&
      hasExt(key, TS_SQL_EXTS)
    ) {
      files.push(key);
    }
  }
  return [...new Set(toAbs(files))].sort();
}
