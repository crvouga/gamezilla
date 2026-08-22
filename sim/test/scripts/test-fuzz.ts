#!/usr/bin/env bun
// @io-wall-ok
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../../..');

function collectSimTests(): string[] {
  const roots = [
    join(REPO_ROOT, 'libs'),
    join(REPO_ROOT, 'pkgs'),
    join(REPO_ROOT, 'sim'),
  ];
  const files: string[] = [];
  function walk(dir: string): void {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const st = statSync(path);
      if (st.isDirectory()) {
        if (name === 'node_modules' || name === '.git') continue;
        walk(path);
        continue;
      }
      if (name.endsWith('.sim.test.ts')) files.push(path);
    }
  }
  for (const root of roots) walk(root);
  return files.toSorted();
}

const seedCount = Number(
  process.argv.find((a) => a.startsWith('--seed-count='))?.slice('--seed-count='.length) ??
    '32'
);

const files = collectSimTests();
if (files.length === 0) {
  console.error('No *.sim.test.ts files found');
  process.exit(1);
}

for (let i = 1; i <= seedCount; i++) {
  const seed = ((Math.random() * 0xffffffff) >>> 0) ^ i;
  console.log(`::group::seed=${seed} (${i}/${seedCount})`);
  for (const file of files) {
    const result = spawnSync('bun', ['test', file], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: { ...process.env, SIM_SEED: String(seed) },
    });
    if (result.status !== 0) {
      console.error(`::error::determinism fuzz failed seed=${seed} file=${file}`);
      process.exit(1);
    }
  }
  console.log('::endgroup::');
}

console.log(`determinism fuzz OK (${seedCount} seeds × ${files.length} files)`);
