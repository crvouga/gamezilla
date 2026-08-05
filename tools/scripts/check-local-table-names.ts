#!/usr/bin/env bun
/**
 * Enforce localOnly table naming: `local_<domain>_<noun>` iff localOnly.
 * See AGENTS.md / remove dual-state plan.
 */
import { LOCAL_CLIENT_TABLE_REGISTRY } from '../../libs/db/src/shared/local-table-registry';
import { SYNC_TABLE_REGISTRY } from '../../libs/db/src/shared/table-registry';
import {
  assertLocalOnlyTableName,
  LOCAL_ONLY_TABLE_NAME_RE,
} from '../../pkgs/sync-engine/src/shared/table-definition';

type Violation = { where: string; detail: string };

function checkRegistry(
  label: string,
  registry: {
    tableNames(): readonly string[];
    get(
      name: string
    ): { readonly tableName: string; readonly localOnly?: boolean } | undefined;
  },
  expectLocalOnly: boolean
): Violation[] {
  const violations: Violation[] = [];
  for (const name of registry.tableNames()) {
    const def = registry.get(name);
    if (def === undefined) continue;
    const localOnly = def.localOnly === true;
    try {
      assertLocalOnlyTableName({ tableName: def.tableName, localOnly });
    } catch (error) {
      violations.push({
        where: `${label}:${def.tableName}`,
        detail: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    if (expectLocalOnly && !localOnly) {
      violations.push({
        where: `${label}:${def.tableName}`,
        detail: 'LOCAL_CLIENT_TABLE_REGISTRY entry must set localOnly: true',
      });
    }
    if (!expectLocalOnly && localOnly) {
      violations.push({
        where: `${label}:${def.tableName}`,
        detail: 'SYNC_TABLE_REGISTRY must not include localOnly tables',
      });
    }
    if (expectLocalOnly && !LOCAL_ONLY_TABLE_NAME_RE.test(def.tableName)) {
      violations.push({
        where: `${label}:${def.tableName}`,
        detail: `must match ${String(LOCAL_ONLY_TABLE_NAME_RE)}`,
      });
    }
  }
  return violations;
}

const violations = [
  ...checkRegistry('SYNC_TABLE_REGISTRY', SYNC_TABLE_REGISTRY, false),
  ...checkRegistry(
    'LOCAL_CLIENT_TABLE_REGISTRY',
    LOCAL_CLIENT_TABLE_REGISTRY,
    true
  ),
];

if (violations.length === 0) {
  console.log(
    `check:local-table-names OK — ${String(LOCAL_CLIENT_TABLE_REGISTRY.tableNames().length)} localOnly table(s).`
  );
  process.exit(0);
}

console.error('check:local-table-names FAILED:');
for (const v of violations) {
  console.error(`  - ${v.where}: ${v.detail}`);
}
process.exit(1);
