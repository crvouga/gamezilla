#!/usr/bin/env bun
// @io-wall-ok — tools composition root

/**
 * Framework table names and retired public DDL constants must not appear
 * outside `pkgs/sync-engine/src/` (product, tools, other pkgs).
 */
import { join } from 'node:path';
import { Glob } from 'bun';

const root = join(import.meta.dirname, '../..');

const FORBIDDEN_RE =
  /\b(sync_engine_push_applied|sync_engine_mutations_applied|sync_engine_mutations|sync_engine_scope_meta|sync_engine_write_rejections|sync_engine_topic_seq|FRAMEWORK_SERVER_DDL|FRAMEWORK_TABLE_NAMES|FRAMEWORK_CACHE_TABLE_NAMES|FRAMEWORK_DURABLE_TABLE_NAMES|allocateTopicPushSeq)\b/;

/** Product + tooling surfaces that must not depend on framework table names. */
const SCAN_GLOBS = [
  'apps/**/*.{ts,tsx}',
  'libs/**/*.{ts,tsx}',
  'pkgs/inbox/**/*.{ts,tsx}',
  'tools/**/*.{ts,tsx}',
] as const;

const ALLOW_PATH_PREFIXES = [
  // This checker (and related sync-engine CI) may name tables in regexes.
  'tools/scripts/check-sync-engine-',
  'tools/scripts/check-domain-table-prefixes.ts',
  'tools/scripts/check-no-domain-hard-delete.ts',
  'tools/scripts/check-fanout-rows-from-reads.ts',
];

function isAllowed(file: string): boolean {
  return ALLOW_PATH_PREFIXES.some((p) => file.startsWith(p));
}

const violations: string[] = [];

for (const pattern of SCAN_GLOBS) {
  for await (const file of new Glob(pattern).scan({
    cwd: root,
    absolute: false,
  })) {
    if (isAllowed(file)) continue;
    if (file.includes('node_modules/')) continue;
    const text = await Bun.file(join(root, file)).text();
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]!;
      if (FORBIDDEN_RE.test(line)) {
        violations.push(`${file}:${String(i + 1)}: ${line.trim()}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('ci:sync-engine-framework-leak FAILED:');
  for (const v of violations.slice(0, 50)) console.error(`  ${v}`);
  if (violations.length > 50) {
    console.error(`  … and ${String(violations.length - 50)} more`);
  }
  process.exit(1);
}

console.log('ci:sync-engine-framework-leak OK');
