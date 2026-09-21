#!/usr/bin/env bun
// @io-wall-ok — CLI: one package's e2e suite (`test:e2e`), run from its root.
/**
 * Every package's `test:e2e` is this script, so every subsystem suite runs
 * under the same compile contract, preloads, timeout and reporting:
 *
 *   "test:e2e": "bun run ../../libs/sim-harness/scripts/test-e2e.ts"
 *
 * It wipes the package's report bucket (`.cache/sim-report`), runs
 * `bun test --parallel tests/e2e` (or the test paths given) with a JUnit report
 * written into that bucket, and exits with the runner's status. With
 * `SIM_REPORT=1` the sims also record frames there; `bun run test:report`
 * (root) folds every package's bucket into one HTML report.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGE_DIR = process.cwd();
const REPORT_DIR = join(PACKAGE_DIR, '.cache/sim-report');
const JUNIT_PATH = join(REPORT_DIR, 'junit.xml');
/** Per test. A live browser (`SIM_MODE=real|stack`) gets the time a person would. */
const TIMEOUT_MS = process.env['SIM_MODE'] === undefined ? 90_000 : 180_000;

/**
 * Arguments pass through to `bun test` in order (`-t name`, `--timeout 1000`
 * keep their values). The default scope `tests/e2e` applies only when none of
 * them names a test path, so a narrowed run never widens to unit tests.
 */
const args = process.argv.slice(2);
const namesPath = args.some(
  (arg) => arg.startsWith('tests/') || /\.test\.[cm]?[jt]sx?$/.test(arg)
);

rmSync(REPORT_DIR, { recursive: true, force: true });
mkdirSync(REPORT_DIR, { recursive: true });

const result = spawnSync(
  'bun',
  [
    'test',
    '--conditions=browser',
    '--conditions=development',
    '--preload',
    '@pkgs/bun-test-solid/preload',
    '--preload',
    '@libs/sim-harness/preload',
    ...(process.env['SIM_PRELOAD'] === undefined
      ? []
      : ['--preload', process.env['SIM_PRELOAD']]),
    '--timeout',
    String(TIMEOUT_MS),
    '--parallel',
    '--reporter=junit',
    `--reporter-outfile=${JUNIT_PATH}`,
    ...args,
    ...(namesPath ? [] : ['tests/e2e']),
  ],
  { cwd: PACKAGE_DIR, stdio: 'inherit', env: process.env }
);

process.exit(result.status ?? 1);
