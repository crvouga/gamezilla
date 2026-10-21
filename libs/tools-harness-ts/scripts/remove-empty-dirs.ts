#!/usr/bin/env bun
// @io-wall-ok — composition root

/**
 * Remove empty directories under the repo root (bottom-up). Skips heavy /
 * generated trees so format stays fast. Safe: Git does not track empty dirs.
 *
 * Gitignored trees are never entered: they belong to running tools, not Git.
 * An embedded Postgres cluster (`.cache/localhost-stack/<id>/postgres/db`)
 * keeps required empty dirs (`pg_logical/snapshots`, `pg_notify`, …); pruning
 * them under a live stack makes every checkpoint fail.
 */
import { readdirSync, rmdirSync, statSync, unlinkSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../../..');

/** Directory basenames never entered (nor removed). */
const SKIP_NAMES = new Set([
  '.git',
  '.cursor',
  '.agents',
  '.vscode',
  'node_modules',
  '.turbo',
  '.wrangler',
  'dist',
  'web-build',
  'coverage',
  'test-results',
  'blob-report',
  'check',
  'verify',
  '.observability',
  'ios',
  'android',
]);

/** Repo-relative paths (trailing `/` for dirs) of ignored, untracked entries. */
function listIgnoredDirs(): Set<string> {
  const result = Bun.spawnSync(
    [
      'git',
      'ls-files',
      '--others',
      '--ignored',
      '--exclude-standard',
      '--directory',
    ],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' }
  );
  if (result.exitCode !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr.toString().trim()}`);
  }
  return new Set(
    result.stdout
      .toString()
      .split('\n')
      .filter((line) => line.endsWith('/'))
  );
}

const IGNORED_DIRS = listIgnoredDirs();

function isIgnoredDir(path: string): boolean {
  const rel = relative(REPO_ROOT, path).split(sep).join('/');
  return IGNORED_DIRS.has(`${rel}/`);
}

/** Junk that should not keep a directory alive. */
const IGNORE_ENTRIES = new Set(['.DS_Store', 'Thumbs.db']);

function listEntries(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function clearIgnoredJunk(dir: string): void {
  for (const name of listEntries(dir)) {
    if (!IGNORE_ENTRIES.has(name)) continue;
    const path = join(dir, name);
    try {
      unlinkSync(path);
    } catch {
      // ignore
    }
  }
}

/**
 * Recursively prune empty children, then remove `dir` when nothing remains.
 * Never removes the repo root.
 */
function pruneEmpty(dir: string, isRoot: boolean): void {
  for (const name of listEntries(dir)) {
    if (IGNORE_ENTRIES.has(name) || SKIP_NAMES.has(name)) continue;
    const path = join(dir, name);
    if (isDirectory(path) && !isIgnoredDir(path)) {
      pruneEmpty(path, false);
    }
  }

  if (isRoot) return;

  clearIgnoredJunk(dir);
  const remaining = listEntries(dir);
  if (remaining.length > 0) return;

  try {
    rmdirSync(dir);
    process.stdout.write(`removed empty dir ${relative(REPO_ROOT, dir)}\n`);
  } catch {
    // raced or not empty anymore
  }
}

pruneEmpty(REPO_ROOT, true);
