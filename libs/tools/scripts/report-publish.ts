#!/usr/bin/env bun
// @io-wall-ok — CI entry: uploads the built report to R2 through wrangler
/**
 * `report-publish.ts [--no-frames]` (Report workflow, publish job): upload
 * `harness-report/index.html` (built by `libs/harness/scripts/report.ts`) to the
 * reports bucket under the commit's key (`report-key.ts`), then print its URL.
 *
 * The key holds the commit sha, so a run of different code writes a different
 * object and never replaces this one; a re-run of the same commit and variant
 * replaces its own report. Needs `CLOUDFLARE_API_TOKEN` and
 * `CLOUDFLARE_ACCOUNT_ID` (the shared secrets `secrets-run` loads).
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readReportHosting, reportKey, reportUrl } from './report-key';

const REPORT_FILE = resolve(
  import.meta.dir,
  '../../../harness-report/index.html'
);
const CACHE_CONTROL = 'public, max-age=300';

function headSha(): string {
  const fromEnv = process.env['GITHUB_SHA']?.trim();
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  const result = Bun.spawnSync(['git', 'rev-parse', 'HEAD']);
  return result.stdout.toString().trim();
}

if (import.meta.main) {
  if (!existsSync(REPORT_FILE)) {
    console.error(`report-publish: ${REPORT_FILE} was not built.`);
    process.exit(1);
  }
  const frames = !process.argv.includes('--no-frames');
  const sha = headSha();
  const hosting = readReportHosting();
  const upload = Bun.spawnSync(
    [
      'bunx',
      '--no-install',
      'wrangler',
      'r2',
      'object',
      'put',
      `${hosting.bucket}/${reportKey(sha, frames)}`,
      '--file',
      REPORT_FILE,
      '--content-type',
      'text/html; charset=utf-8',
      '--cache-control',
      CACHE_CONTROL,
      '--remote',
    ],
    { stdout: 'inherit', stderr: 'inherit' }
  );
  if (upload.exitCode !== 0) process.exit(upload.exitCode ?? 1);
  console.log(`report-publish: ${reportUrl(hosting.hostname, sha, frames)}`);
}
