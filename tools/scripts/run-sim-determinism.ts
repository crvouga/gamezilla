#!/usr/bin/env bun
// @io-wall-ok — tools composition root
/**
 * PR determinism gate: run every `*.sim.test.ts` twice with the same seed.
 * Fails if either run exits non-zero (tests assert equal hashes internally).
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { Glob } from 'bun';

const REPO_ROOT = join(import.meta.dirname, '../..');
const SEED = process.env['SIM_SEED'] ?? '42';

const files: string[] = [];
for await (const file of new Glob('{libs,pkgs}/**/*.sim.test.ts').scan({
  cwd: REPO_ROOT,
  absolute: true,
})) {
  if (!isRunnableSimTest(file)) continue;
  files.push(file);
}
for await (const file of new Glob('sim/test/**/*.sim.test.{ts,tsx}').scan({
  cwd: REPO_ROOT,
  absolute: true,
})) {
  if (!isRunnableSimTest(file)) continue;
  files.push(file);
}
files.sort();

if (files.length === 0) {
  console.error('ci:sim-determinism FAILED: no *.sim.test.ts files found');
  process.exit(1);
}

console.log(
  `ci:sim-determinism: ${String(files.length)} files ×2 (seed=${SEED})`
);

let failed = false;
for (const file of files) {
  const rel = file.slice(REPO_ROOT.length + 1);
  for (const pass of [1, 2] as const) {
    console.log(`ci:sim-determinism: ${rel} pass ${String(pass)}/2…`);
    const status = runSimTest(rel, file);
    if (status !== 0) {
      failed = true;
      console.error(
        `ci:sim-determinism FAILED: ${rel} (pass ${String(pass)}, seed=${SEED})`
      );
      break;
    }
  }
  if (!failed) {
    console.log(`ok ${rel} (×2 seed=${SEED})`);
  }
}

if (failed) process.exit(1);
console.log(`ci:sim-determinism OK (${String(files.length)} files ×2)`);

/** Scaffold / aspirational templates are not executable determinism targets. */
function isRunnableSimTest(absFile: string): boolean {
  return !absFile.includes('.template.');
}

function runSimTest(rel: string, absFile: string): number {
  const env = {
    ...process.env,
    SIM_SEED: SEED,
    // Determinism gate asserts hashes — skip HTML frame I/O (faster, no wipe races).
    SIM_REPORT: '0',
  };
  if (rel.startsWith('sim/test/')) {
    const result = spawnSync(
      'bunx',
      [
        'jest',
        '--config',
        './jest.config.cjs',
        '--runInBand',
        '--forceExit',
        absFile,
      ],
      {
        cwd: join(REPO_ROOT, 'sim/test'),
        env,
        stdio: 'inherit',
      }
    );
    return result.status ?? 1;
  }
  const result = spawnSync('bun', ['test', absFile], {
    cwd: REPO_ROOT,
    env,
    stdio: 'inherit',
  });
  return result.status ?? 1;
}
