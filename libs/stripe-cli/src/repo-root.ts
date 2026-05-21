import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { STRIPE_CLI_LOG_TAG } from './constants';

function isMonorepoRootPackageJson(pkgPath: string): boolean {
  if (!existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      workspaces?: unknown;
    };
    const w = pkg.workspaces;
    if (w === undefined) return false;
    if (Array.isArray(w)) return w.length > 0;
    if (typeof w === 'object' && w !== null && !Array.isArray(w))
      return Object.keys(w).length > 0;
    return false;
  } catch {
    return false;
  }
}

/**
 * Walk upward from `startDir` until a directory whose `package.json` declares
 * `workspaces` (Bun/npm monorepo root). Nested packages may have their own
 * `turbo.json`; we must not stop there.
 */
export function resolveWorkspaceRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    if (isMonorepoRootPackageJson(join(dir, 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `${STRIPE_CLI_LOG_TAG}: monorepo root (package.json with workspaces) not found walking up from ${startDir}`
      );
    }
    dir = parent;
  }
}
