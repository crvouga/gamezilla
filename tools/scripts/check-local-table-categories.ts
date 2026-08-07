#!/usr/bin/env bun
/**
 * Enforce CACHE vs DURABLE table categories for local.db.
 * DURABLE tables must never appear as wipeable cache-only names without listing.
 */
import { LOCAL_DOMAIN_TABLE_NAMES } from '../../libs/db/src/shared/table-registry';
import {
  FRAMEWORK_CACHE_TABLE_NAMES,
  FRAMEWORK_DURABLE_TABLE_NAMES,
} from '../../pkgs/sync-engine/src/shared/framework-server-ddl';

const DURABLE = new Set<string>(FRAMEWORK_DURABLE_TABLE_NAMES);
const FRAMEWORK_CACHE = new Set<string>(FRAMEWORK_CACHE_TABLE_NAMES);

const violations: string[] = [];

for (const name of LOCAL_DOMAIN_TABLE_NAMES) {
  if (name.startsWith('local_')) {
    violations.push(
      `${name}: local_ prefix forbidden (use CACHE domain tables)`
    );
  }
  if (DURABLE.has(name)) {
    violations.push(`${name}: durable framework table listed as domain`);
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
  `check:local-table-categories OK — durable=${[...DURABLE].join(',')}; domain=${String(LOCAL_DOMAIN_TABLE_NAMES.length)}`
);
