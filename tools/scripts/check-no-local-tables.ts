#!/usr/bin/env bun
/**
 * Forbid sync `local_*` app tables.
 * Client schema must be a pure subset of the remote Postgres schema.
 */
import { LOCAL_DOMAIN_TABLE_NAMES } from '../../libs/db/src/shared/table-registry';

type Violation = { where: string; detail: string };

const violations: Violation[] = [];

for (const name of LOCAL_DOMAIN_TABLE_NAMES) {
  if (name.startsWith('local_')) {
    violations.push({
      where: `LOCAL_DOMAIN_TABLE_NAMES:${name}`,
      detail: `local_ table prefix is reserved; client DB must subset Postgres`,
    });
  }
}

if (violations.length === 0) {
  console.log(
    `check:no-local-tables OK — ${String(LOCAL_DOMAIN_TABLE_NAMES.length)} sync table(s), 0 local_.`
  );
  process.exit(0);
}

console.error('check:no-local-tables FAILED:');
for (const v of violations) {
  console.error(`  - ${v.where}: ${v.detail}`);
}
process.exit(1);
