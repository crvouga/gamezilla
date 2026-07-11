#!/usr/bin/env bun
/**
 * Verify the Lingui catalog matches current source strings.
 *
 * Runs extract + compile and fails only when those steps mutate catalog files.
 * Unlike `git diff --exit-code`, this passes with uncommitted-but-current i18n
 * artifacts while developing locally. CI still fails when committed catalogs are
 * stale because extract rewrites them on a clean checkout.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');
const I18N_DIR = join(REPO_ROOT, 'apps/client/src/i18n');

function listI18nFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listI18nFiles(full));
    } else {
      files.push(full);
    }
  }
  return files.sort();
}

function fingerprintI18nDir(): string {
  const hash = createHash('sha256');
  for (const file of listI18nFiles(I18N_DIR)) {
    hash.update(relative(REPO_ROOT, file));
    hash.update('\0');
    hash.update(readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function runOrExit(command: string, args: readonly string[]): void {
  const result = spawnSync(command, args, { cwd: REPO_ROOT, stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const before = fingerprintI18nDir();
runOrExit('lingui', ['extract']);
runOrExit('bun', ['run', 'i18n:compile']);
const after = fingerprintI18nDir();

if (before === after) {
  process.exit(0);
}

process.stderr.write(
  [
    'i18n catalog is out of date with source strings.',
    'Run: bun run i18n:extract && bun run i18n:compile',
    '',
  ].join('\n')
);

const diff = spawnSync('git', ['diff', '--', 'apps/client/src/i18n'], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
});
if (diff.stdout.length > 0) {
  process.stderr.write(diff.stdout);
}

process.exit(1);
