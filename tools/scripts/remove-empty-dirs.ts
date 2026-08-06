#!/usr/bin/env bun
/**
 * Remove empty directories under the repo root (bottom-up). Skips heavy /
 * generated trees so format stays fast. Safe: Git does not track empty dirs.
 */
import { readdirSync, rmdirSync, statSync, unlinkSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../..');

/** Directory basenames never entered (nor removed). */
const SKIP_NAMES = new Set([
  '.git',
  '.cursor',
  '.agents',
  '.vscode',
  'node_modules',
  '.turbo',
  '.expo',
  '.wrangler',
  'dist',
  'web-build',
  'coverage',
  'playwright-report',
  'test-results',
  'blob-report',
  'check',
  '.observability',
  'ios',
  'android',
]);

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
    if (isDirectory(path)) {
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
