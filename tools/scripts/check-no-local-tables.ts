#!/usr/bin/env bun
/**
 * Forbid PowerSync `localOnly` / `local_*` app tables.
 * Client schema must be a pure subset of the remote Postgres schema.
 */
import { SYNC_TABLE_REGISTRY } from '../../libs/db/src/shared/table-registry';
import { LOCAL_ONLY_TABLE_NAME_RE } from '../../pkgs/sync-engine/src/shared/table-definition';

type Violation = { where: string; detail: string };

const violations: Violation[] = [];

for (const name of SYNC_TABLE_REGISTRY.tableNames()) {
  const def = SYNC_TABLE_REGISTRY.get(name);
  if (def === undefined) continue;
  if (def.localOnly === true) {
    violations.push({
      where: `SYNC_TABLE_REGISTRY:${def.tableName}`,
      detail: 'localOnly tables are forbidden; client DB must subset Postgres',
    });
  }
  if (LOCAL_ONLY_TABLE_NAME_RE.test(def.tableName)) {
    violations.push({
      where: `SYNC_TABLE_REGISTRY:${def.tableName}`,
      detail: `local_ table prefix is reserved for removed localOnly tables`,
    });
  }
}

if (violations.length === 0) {
  console.log(
    `check:no-local-tables OK — ${String(SYNC_TABLE_REGISTRY.tableNames().length)} sync table(s), 0 localOnly.`
  );
  process.exit(0);
}

console.error('check:no-local-tables FAILED:');
for (const v of violations) {
  console.error(`  - ${v.where}: ${v.detail}`);
}
process.exit(1);
