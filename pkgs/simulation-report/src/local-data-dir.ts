import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Repo-root directory name for local Node-FS report artifacts. */
export const LOCAL_REPORT_DATA_DIRNAME = 'simulation-report-data';

/**
 * Walk up from `startDir` and return the outermost directory that contains
 * `turbo.json` (true monorepo root). Package-level `turbo.json` files
 * (`extends: ["//"]`) must not win over the workspace root.
 */
export function findMonorepoRoot(startDir: string): string | null {
  let dir = resolve(startDir);
  let found: string | null = null;
  for (;;) {
    if (existsSync(join(dir, 'turbo.json'))) found = dir;
    const parent = dirname(dir);
    if (parent === dir) return found;
    dir = parent;
  }
}

/**
 * Absolute path to `<repo>/simulation-report-data` (or `<startDir>/…`
 * when no monorepo root is found).
 */
export function resolveLocalReportDataDir(
  startDir: string = process.cwd()
): string {
  const root = findMonorepoRoot(startDir) ?? resolve(startDir);
  return join(root, LOCAL_REPORT_DATA_DIRNAME);
}
