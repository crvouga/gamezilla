/**
 * Path helpers for local report data. Filesystem probes are injected — no
 * wall `node:fs` in this module.
 */
import { dirname, join, resolve } from 'node:path';

/** Repo-root directory name for local Node-FS report artifacts (legacy). */
export const LOCAL_REPORT_DATA_DIRNAME = '.cache/sim-console-data';

/**
 * Expo static assets directory for the latest sim test report dump
 * (`@sim/console` `public/reports`).
 */
export const SIM_CONSOLE_REPORTS_DIRNAME = 'sim/console/public/reports';

export type PathExists = (absolutePath: string) => boolean;

/**
 * RandomActionsReport up from `startDir` and return the outermost directory that contains
 * `turbo.json` (true monorepo root). Package-level `turbo.json` files
 * (`extends: ["//"]`) must not win over the workspace root.
 */
export function findMonorepoRoot(
  startDir: string,
  exists: PathExists
): string | null {
  let dir = resolve(startDir);
  let found: string | null = null;
  for (;;) {
    if (exists(join(dir, 'turbo.json'))) found = dir;
    const parent = dirname(dir);
    if (parent === dir) return found;
    dir = parent;
  }
}

/**
 * Absolute path to `<repo>/.cache/sim-console-data` (or `<startDir>/…`
 * when no monorepo root is found).
 */
export function resolveLocalReportDataDir(
  startDir: string,
  exists: PathExists
): string {
  const root = findMonorepoRoot(startDir, exists) ?? resolve(startDir);
  return join(root, LOCAL_REPORT_DATA_DIRNAME);
}

/**
 * Absolute path to `<repo>/sim/console/public/reports` for the static-bundle
 * report dump consumed by the Expo client.
 */
export function resolveSimConsoleReportsDir(
  startDir: string,
  exists: PathExists
): string {
  const root = findMonorepoRoot(startDir, exists) ?? resolve(startDir);
  return join(root, SIM_CONSOLE_REPORTS_DIRNAME);
}

/** Repo-relative POSIX path, or null when outside the monorepo / invalid. */
export function toRepoRelativePath(
  absolutePath: string,
  startDir: string,
  exists: PathExists
): string | null {
  const root = findMonorepoRoot(startDir, exists);
  if (!root) return null;
  const abs = resolve(absolutePath);
  if (!abs.startsWith(root)) return null;
  const rel = abs.slice(root.length).replace(/^[/\\]+/, '');
  return rel.split('\\').join('/');
}
