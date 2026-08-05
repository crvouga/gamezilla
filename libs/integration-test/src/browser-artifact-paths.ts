import { existsSync } from 'node:fs';
import path from 'node:path';

/** Repo-root folder for browser E2E artifacts (screenshots). */
export const CHECK_ARTIFACTS_DIR = 'check';

export const CHECK_BROWSER_ARTIFACTS_DIR = path.join(
  CHECK_ARTIFACTS_DIR,
  'browser-artifacts'
);

export function resolveGamezillaRepoRoot(fromDir: string): string {
  let dir = path.resolve(fromDir);
  for (;;) {
    if (existsSync(path.join(dir, 'turbo.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not find monorepo root (turbo.json) walking up from ${fromDir}`
      );
    }
    dir = parent;
  }
}

export function browserArtifactDir(repoRoot: string): string {
  return path.join(repoRoot, CHECK_BROWSER_ARTIFACTS_DIR);
}
