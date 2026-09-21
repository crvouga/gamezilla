#!/usr/bin/env bun
// @io-wall-ok — lint CLI entry root (scripts/**).
/**
 * Run Biome or ESLint over the whole repo, or only what a PR changed.
 *
 * Linting is per-file, so a file that has not changed was already linted when
 * it last did — on `main`, by the deploy gate, which always runs everything.
 * That makes a PR's scope the diff, and the diff is usually a handful of
 * files: Biome measured 4008 files in 219s against 316 in 17s on a branch that
 * touched a lot, and a normal PR is far smaller. Most of that cost is the 42
 * Grit plugins, which run per file.
 *
 * `CHECK_CHANGED_SINCE` (set by `turbo-ci-run` on PR runs, never locally)
 * carries the base commit. It is in each task's turbo `env`, so a changed-only
 * result can never be served to a run that asked for the full sweep.
 *
 * Anything that changes what linting *means* — the Biome config, a Grit
 * plugin, the ESLint config, the Solid scope map — falls back to the full
 * sweep, because then the unchanged files have not been checked under the new
 * rules.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');

/** Touch one of these and every file needs linting again. */
const CONFIG_PATHS = [
  'biome.json',
  'eslint.config.mjs',
  'libs/tools/biome-plugins/',
  'libs/tools/port/solid-scope.json',
] as const;

const LINTABLE = /\.(?:m|c)?[jt]sx?$/;

function changedSince(base: string): readonly string[] | null {
  const result = spawnSync('git', ['diff', '--name-only', `${base}...HEAD`], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) return null;
  return result.stdout.split('\n').filter((line) => line.length > 0);
}

function configChanged(paths: readonly string[]): string | null {
  return (
    paths.find((path) => CONFIG_PATHS.some((cfg) => path.startsWith(cfg))) ??
    null
  );
}

function run(command: string, args: readonly string[]): never {
  const result = spawnSync(command, args, { cwd: REPO_ROOT, stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

function main(): never {
  const tool = process.argv[2];
  if (tool !== 'biome' && tool !== 'eslint') {
    console.error('usage: lint-changed.ts <biome|eslint>');
    process.exit(1);
  }
  const full = (): never =>
    tool === 'biome'
      ? run('bunx', ['biome', 'check', '--error-on-warnings', '.'])
      : run('bunx', [
          'eslint',
          '--cache',
          '--cache-location',
          '.eslintcache',
          '--cache-strategy',
          'content',
          '--max-warnings',
          '0',
          '.',
        ]);

  const base = process.env['CHECK_CHANGED_SINCE']?.trim();
  if (base === undefined || base.length === 0) full();

  const changed = changedSince(base);
  if (changed === null) {
    console.warn(`lint-changed: cannot diff against ${base}; linting all.`);
    full();
  }
  const config = configChanged(changed);
  if (config !== null) {
    console.log(
      `lint-changed: '${config}' changes what lint means; linting all.`
    );
    full();
  }

  const files = changed
    .filter((path) => LINTABLE.test(path))
    .filter((path) => existsSync(join(REPO_ROOT, path)));
  if (files.length === 0) {
    console.log(`lint-changed: no lintable file changed since ${base}.`);
    process.exit(0);
  }
  console.log(
    `lint-changed: ${tool} over ${String(files.length)} changed file(s).`
  );
  if (tool === 'biome') {
    run('bunx', ['biome', 'check', '--error-on-warnings', ...files]);
  }
  run('bunx', [
    'eslint',
    '--cache',
    '--cache-location',
    '.eslintcache',
    '--cache-strategy',
    'content',
    '--max-warnings',
    '0',
    '--no-warn-ignored',
    ...files,
  ]);
}

main();
