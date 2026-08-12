import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Repo-root directory name for local Node-FS report artifacts. */
export const LOCAL_REPORT_DATA_DIRNAME = 'simulation-report-data';

/**
 * Walk up from `startDir` until a `turbo.json` is found (monorepo root).
 * Returns `null` when none exists.
 */
export function findMonorepoRoot(startDir: string): string | null {
  let dir = resolve(startDir);
  for (;;) {
    if (existsSync(join(dir, 'turbo.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
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
