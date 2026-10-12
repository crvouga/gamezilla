#!/usr/bin/env bun
// @io-wall-ok
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { recordSeeds } from './seed-record';

const REPO_ROOT = join(import.meta.dirname, '../../..');

function collectHarnessTests(): string[] {
  const roots = [join(REPO_ROOT, 'pkgs'), join(REPO_ROOT, 'libs')];
  const files: string[] = [];
  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const path = join(dir, name);
      const st = statSync(path);
      if (st.isDirectory()) {
        if (
          name === 'node_modules' ||
          name === '.git' ||
          name === 'dist' ||
          name === '.turbo'
        ) {
          continue;
        }
        walk(path);
        continue;
      }
      // Prefer package-level tests/ suites.
      const underTests = path.includes('/tests/');
      if (
        underTests &&
        (name.endsWith('.test.ts') || name.endsWith('.test.tsx')) &&
        !name.endsWith('.contract.test.ts')
      ) {
        files.push(path);
      }
    }
  }
  for (const root of roots) walk(root);
  return files.toSorted();
}

// `--seed-count=` wins; `HARNESS_FUZZ_SEEDS` is the budget a check profile
// sets (`libs/tools/scripts/check-profile.ts`).
const seedCount = Number(
  process.argv
    .find((a) => a.startsWith('--seed-count='))
    ?.slice('--seed-count='.length) ??
    process.env['HARNESS_FUZZ_SEEDS'] ??
    '32'
);
// `HARNESS_SEED=<seed>` replays the one seed a failed run printed.
const replaySeed = process.env['HARNESS_SEED'];

const files = collectHarnessTests();
if (files.length === 0) {
  console.error('No harness test files found under tests/');
  process.exit(1);
}

const seeds =
  replaySeed === undefined
    ? Array.from(
        { length: seedCount },
        (_, index) => ((Math.random() * 0xffffffff) >>> 0) ^ (index + 1)
      )
    : [Number(replaySeed)];

recordSeeds('fuzz', { seeds, files: files.length, failed: null });

for (const [index, seed] of seeds.entries()) {
  const i = index + 1;
  process.stdout.write(`::group::seed=${seed} (${i}/${seeds.length})\n`);
  for (const file of files) {
    const result = spawnSync('bun', ['test', file], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: { ...process.env, HARNESS_SEED: String(seed) },
    });
    if (result.status !== 0) {
      console.error(
        `::error::determinism fuzz failed seed=${seed} file=${file}`
      );
      console.error(`Replay: HARNESS_SEED=${seed} bun test ${file}`);
      recordSeeds('fuzz', {
        seeds,
        files: files.length,
        failed: { seed, file, replay: `HARNESS_SEED=${seed} bun test ${file}` },
      });
      process.exit(1);
    }
  }
  process.stdout.write('::endgroup::\n');
}

process.stdout.write(
  `determinism fuzz OK (${seeds.length} seeds × ${files.length} files)\n`
);
