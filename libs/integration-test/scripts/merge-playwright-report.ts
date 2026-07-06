import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import {
  qaPlaywrightPaths,
  resolveGamezillaRepoRoot,
} from '../src/qa-playwright-paths';

const pkgDir = path.join(resolveGamezillaRepoRoot(import.meta.dir), 'libs/integration-test');
const { blobDir, reportDir } = qaPlaywrightPaths(resolveGamezillaRepoRoot(pkgDir));

function collectBlobReportFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectBlobReportFiles(fullPath));
      continue;
    }
    if (entry.endsWith('.zip')) files.push(fullPath);
  }
  return files;
}

const blobFiles = collectBlobReportFiles(blobDir);
if (blobFiles.length === 0) {
  if (existsSync(path.join(reportDir, 'index.html'))) {
    process.stdout.write(
      `[qa:report] No blob reports in ${blobDir}; using existing HTML report at ${reportDir}\n`
    );
    process.exit(0);
  }
  process.stderr.write(
    `[qa:report] No Playwright blob reports found under ${blobDir}. Run test:e2e first.\n`
  );
  process.exit(1);
}

execSync(
  'bun --bun x playwright merge-reports --config playwright/playwright.merge.config.ts ../../qa/blob-report',
  {
    cwd: pkgDir,
    stdio: 'inherit',
  }
);

process.stdout.write(
  `[qa:report] Merged ${String(blobFiles.length)} blob report(s) into ${reportDir}\n`
);
