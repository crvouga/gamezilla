#!/usr/bin/env bun
/**
 * Run Prettier only on paths Git would list (respects every .gitignore in the
 * tree). `.prettierignore` is still applied by Prettier itself.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');
const BATCH_SIZE = 200;

const mode = process.argv.includes('--check') ? '--check' : '--write';

function listGitFiles(): string[] {
  const git = spawnSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  );
  if (git.status !== 0) {
    process.stderr.write(git.stderr || 'git ls-files failed\n');
    process.exit(git.status ?? 1);
  }
  return git.stdout.split('\0').filter((path) => path.length > 0);
}

function runPrettierBatch(batch: readonly string[]): number {
  const result = spawnSync('prettier', [mode, '--ignore-unknown', ...batch], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

function runPrettierOnGitFiles(files: readonly string[]): number {
  if (files.length === 0) return 0;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const status = runPrettierBatch(files.slice(i, i + BATCH_SIZE));
    if (status !== 0) return status;
  }
  return 0;
}

process.exit(runPrettierOnGitFiles(listGitFiles()));
