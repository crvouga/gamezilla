/**
 * Shared filesystem roots for deterministic-I/O CI gates.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const REPO_ROOT = join(import.meta.dirname, '../..');

const SKIP_DIR = new Set([
  'node_modules',
  'dist',
  '.git',
  '.turbo',
  'coverage',
  '.expo',
  '.wrangler',
  'ios',
  'android',
  'data',
]);

function walk(dir: string, out: string[], exts: readonly string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR.has(entry.name)) continue;
      walk(abs, out, exts);
      continue;
    }
    if (!entry.isFile()) continue;
    if (entry.name.endsWith('.d.ts')) continue;
    if (!exts.some((ext) => entry.name.endsWith(ext))) continue;
    out.push(abs);
  }
}

function addIfDir(dir: string, out: string[], exts: readonly string[]): void {
  try {
    if (statSync(dir).isDirectory()) walk(dir, out, exts);
  } catch {
    // missing
  }
}

const TS_EXTS = ['.ts', '.tsx'] as const;
const TS_SQL_EXTS = ['.ts', '.tsx', '.sql'] as const;

/** Product + tooling TS/TSX scanned by bare-io / resolve-wall gates. */
export function collectIoScanFiles(): string[] {
  const files: string[] = [];

  addIfDir(join(REPO_ROOT, 'apps/client/src'), files, TS_EXTS);
  addIfDir(join(REPO_ROOT, 'apps/client/scripts'), files, TS_EXTS);
  addIfDir(join(REPO_ROOT, 'apps/api/src'), files, TS_EXTS);
  addIfDir(join(REPO_ROOT, 'apps/api/scripts'), files, TS_EXTS);
  addIfDir(join(REPO_ROOT, 'apps/postgres'), files, TS_EXTS);

  const libsRoot = join(REPO_ROOT, 'libs');
  if (existsSync(libsRoot)) {
    for (const name of readdirSync(libsRoot)) {
      addIfDir(join(libsRoot, name, 'src'), files, TS_EXTS);
      addIfDir(join(libsRoot, name, 'scripts'), files, TS_EXTS);
      addIfDir(join(libsRoot, name, 'e2e'), files, TS_EXTS);
    }
  }

  const pkgsRoot = join(REPO_ROOT, 'pkgs');
  if (existsSync(pkgsRoot)) {
    for (const name of readdirSync(pkgsRoot)) {
      addIfDir(join(pkgsRoot, name, 'src'), files, TS_EXTS);
      addIfDir(join(pkgsRoot, name, 'scripts'), files, TS_EXTS);
      addIfDir(join(pkgsRoot, name, 'db'), files, TS_EXTS);
    }
  }

  return [...new Set(files)].sort();
}

/** TS/TSX/SQL scanned by the SQL wall-I/O gate. */
export function collectSqlWallScanFiles(): string[] {
  const files: string[] = [];

  for (const app of ['client', 'api', 'postgres'] as const) {
    addIfDir(join(REPO_ROOT, 'apps', app), files, TS_SQL_EXTS);
  }

  const libsRoot = join(REPO_ROOT, 'libs');
  if (existsSync(libsRoot)) {
    for (const name of readdirSync(libsRoot)) {
      addIfDir(join(libsRoot, name), files, TS_SQL_EXTS);
    }
  }

  const pkgsRoot = join(REPO_ROOT, 'pkgs');
  if (existsSync(pkgsRoot)) {
    for (const name of readdirSync(pkgsRoot)) {
      addIfDir(join(pkgsRoot, name), files, TS_SQL_EXTS);
    }
  }

  return [...new Set(files)].sort();
}
