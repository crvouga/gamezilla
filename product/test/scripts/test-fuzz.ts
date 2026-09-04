#!/usr/bin/env bun
// @io-wall-ok
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../../..');

function collectSimTests(): string[] {
  const roots = [
    join(REPO_ROOT, 'product/test/tests'),
    join(REPO_ROOT, 'pkgs'),
    join(REPO_ROOT, 'libs'),
  ];
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

const seedCount = Number(
  process.argv
    .find((a) => a.startsWith('--seed-count='))
    ?.slice('--seed-count='.length) ?? '32'
);

const files = collectSimTests();
if (files.length === 0) {
  console.error('No sim test files found under tests/');
  process.exit(1);
}

for (let i = 1; i <= seedCount; i++) {
  const seed = ((Math.random() * 0xffffffff) >>> 0) ^ i;
  process.stdout.write(`::group::seed=${seed} (${i}/${seedCount})\n`);
  for (const file of files) {
    const result = spawnSync('bun', ['test', file], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: { ...process.env, SIM_SEED: String(seed) },
    });
    if (result.status !== 0) {
      console.error(
        `::error::determinism fuzz failed seed=${seed} file=${file}`
      );
      process.exit(1);
    }
  }
  process.stdout.write('::endgroup::\n');
}

process.stdout.write(
  `determinism fuzz OK (${seedCount} seeds × ${files.length} files)\n`
);
