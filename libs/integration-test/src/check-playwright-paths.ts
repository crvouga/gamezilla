import { existsSync } from 'node:fs';
import path from 'node:path';

/** Repo-root folder for all Playwright check artifacts (reports, traces). */
export const CHECK_ARTIFACTS_DIR = 'check';

export const CHECK_PLAYWRIGHT_REPORT_DIR = path.join(
  CHECK_ARTIFACTS_DIR,
  'playwright-report'
);
export const CHECK_PLAYWRIGHT_RESULTS_DIR = path.join(
  CHECK_ARTIFACTS_DIR,
  'test-results'
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

export function checkPlaywrightPaths(repoRoot: string) {
  return {
    reportDir: path.join(repoRoot, CHECK_PLAYWRIGHT_REPORT_DIR),
    resultsDir: path.join(repoRoot, CHECK_PLAYWRIGHT_RESULTS_DIR),
  };
}
