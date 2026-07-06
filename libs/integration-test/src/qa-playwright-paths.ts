import { existsSync } from 'node:fs';
import path from 'node:path';

/** Repo-root folder for all Playwright QA artifacts (reports, traces). */
export const QA_ARTIFACTS_DIR = 'qa';

export const QA_PLAYWRIGHT_REPORT_DIR = path.join(
  QA_ARTIFACTS_DIR,
  'playwright-report'
);
export const QA_PLAYWRIGHT_RESULTS_DIR = path.join(
  QA_ARTIFACTS_DIR,
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

export function qaPlaywrightPaths(repoRoot: string) {
  return {
    reportDir: path.join(repoRoot, QA_PLAYWRIGHT_REPORT_DIR),
    resultsDir: path.join(repoRoot, QA_PLAYWRIGHT_RESULTS_DIR),
  };
}
