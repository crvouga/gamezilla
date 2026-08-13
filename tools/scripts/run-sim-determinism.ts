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
for await (const file of new Glob('test/**/*.sim.test.{ts,tsx}').scan({
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

let failed = false;
for (const file of files) {
  const rel = file.slice(REPO_ROOT.length + 1);
  for (const pass of [1, 2] as const) {
    const result = runSimTest(rel, file);
    if (result.status !== 0) {
      failed = true;
      console.error(
        `ci:sim-determinism FAILED: ${rel} (pass ${String(pass)}, seed=${SEED})`
      );
      if (result.stdout) console.error(result.stdout);
      if (result.stderr) console.error(result.stderr);
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

function runSimTest(
  rel: string,
  absFile: string
): ReturnType<typeof spawnSync> {
  const env = { ...process.env, SIM_SEED: SEED };
  if (rel.startsWith('test/ui/')) {
    return spawnSync(
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
        cwd: join(REPO_ROOT, 'test/ui'),
        env,
        encoding: 'utf8',
      }
    );
  }
  return spawnSync('bun', ['test', absFile], {
    cwd: REPO_ROOT,
    env,
    encoding: 'utf8',
  });
}

