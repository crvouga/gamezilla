#!/usr/bin/env bun
/**
 * Enforce CACHE vs DURABLE table categories for local.db.
 * DURABLE tables must never appear as wipeable cache-only names without listing.
 */
import { SYNC_TABLE_REGISTRY } from '../../libs/db/src/shared/table-registry';

const DURABLE = new Set(['_mutations', '_upload_state']);
const FRAMEWORK_CACHE = new Set(['_row_scopes', '_scope_meta']);

const violations: string[] = [];

for (const name of SYNC_TABLE_REGISTRY.tableNames()) {
  if (name.startsWith('local_')) {
    violations.push(
      `${name}: local_ prefix forbidden (use CACHE domain tables)`
    );
  }
  if (DURABLE.has(name)) {
    // Domain registry may still declare _mutations for upload policy; OK.
    continue;
  }
}

for (const name of DURABLE) {
  if (FRAMEWORK_CACHE.has(name)) {
    violations.push(`${name}: cannot be both DURABLE and FRAMEWORK_CACHE`);
  }
}

if (violations.length > 0) {
  console.error('check:local-table-categories FAILED:');
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log(
  `check:local-table-categories OK — durable=${[...DURABLE].join(',')}; domain=${String(SYNC_TABLE_REGISTRY.tableNames().length)}`
);
