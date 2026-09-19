// @io-wall-ok — CLI: run the product suite with reporting, then build + open HTML
/**
 * `bun run --filter @apps/product test:report [bun test args…]`
 *
 * Wipes the report bucket, runs `bun test` with `SIM_REPORT=1` plus a JUnit
 * reporter, renders `sim-report/index.html`, then opens it. Exits with the
 * test status.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

import { run } from '@pkgs/os';

import {
  PRODUCT_DIR,
  SIM_REPORT_DATA_DIR,
  SIM_REPORT_JUNIT_PATH,
} from '../src/test/setup/sim-report';
import { buildSimReport } from './build-sim-report';

const extraArgs = process.argv.slice(2);

rmSync(SIM_REPORT_DATA_DIR, { recursive: true, force: true });
mkdirSync(SIM_REPORT_DATA_DIR, { recursive: true });

const test = spawnSync(
  'bun',
  [
    'test',
    '--conditions=browser',
    '--conditions=development',
    '--preload',
    '@pkgs/bun-test-solid/preload',
    '--preload',
    './bun-preload.ts',
    '--timeout',
    '90000',
    '--reporter=junit',
    `--reporter-outfile=${SIM_REPORT_JUNIT_PATH}`,
    ...(extraArgs.length > 0 ? extraArgs : ['tests']),
  ],
  {
    cwd: PRODUCT_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      SIM_REPORT: '1',
      NODE_OPTIONS: process.env['NODE_OPTIONS'] ?? '--max-old-space-size=8192',
    },
  }
);

const result = await buildSimReport();
process.stdout.write(
  `\n[sim-report] ${result.status} · ${String(result.testCount)} test(s)\n[sim-report] open ${result.indexPath}\n`
);
run('open', [result.indexPath]);
process.exit(test.status ?? 1);
