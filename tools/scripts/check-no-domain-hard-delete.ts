#!/usr/bin/env bun
/**
 * Fail if libs domain mutation/SQL paths hard-delete domain rows.
 * Soft-delete (`UPDATE … SET _deleted_at`) is required.
 */
import { join } from 'node:path';
import { Glob } from 'bun';

const root = join(import.meta.dirname, '../..');

const DELETE_FROM_RE = /\bDELETE\s+FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;

/** Framework / non-domain tables that may still hard-delete. */
const ALLOWED_TABLES = new Set([
  '_mutations',
  '_mutations_applied',
  '_scope_meta',
  '_push_applied',
  '_sync_topic_seq',
  'write_rejections',
]);

const SCAN_GLOBS = [
  'libs/**/shared/mutations/**/*.{ts,tsx}',
  'libs/**/shared/**/*-sql/**/*.{ts,tsx}',
  'libs/**/shared/friends-sql/**/*.{ts,tsx}',
  'libs/friends/src/server/friend-repository.ts',
  'libs/friends/src/server/block-service.ts',
  'pkgs/sync-engine/src/server/select-fanout-rows.ts',
] as const;

const violations: string[] = [];

for (const pattern of SCAN_GLOBS) {
  const files = new Glob(pattern).scan({ cwd: root, absolute: true });
  for await (const file of files) {
    if (file.includes('/dist/') || file.includes('.test.')) continue;
    const text = await Bun.file(file).text();
    const rel = file.slice(root.length + 1);
    for (const match of text.matchAll(DELETE_FROM_RE)) {
      const table = match[1]!;
      if (ALLOWED_TABLES.has(table)) continue;
      const line = text.slice(0, match.index ?? 0).split('\n').length;
      violations.push(`${rel}:${line}: DELETE FROM ${table}`);
    }
  }
}

if (violations.length > 0) {
  console.error('ci:no-domain-hard-delete FAILED:');
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log('ci:no-domain-hard-delete OK');
