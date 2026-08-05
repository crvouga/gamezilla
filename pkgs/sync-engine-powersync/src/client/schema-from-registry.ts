import { Schema, Table, column, type BaseColumnType } from '@powersync/common';

import type {
  TableColumnType,
  TableDefinition,
} from '@pkgs/sync-engine/shared/table-definition';
import type { TableRegistry } from '@pkgs/sync-engine/shared/table-registry';

function mapColumnType(
  type: TableColumnType
): BaseColumnType<string | number | null> {
  if (type === 'integer') return column.integer;
  if (type === 'real') return column.real;
  return column.text;
}

function toPowerSyncTable(def: TableDefinition): Table {
  const cols: Record<string, BaseColumnType<string | number | null>> = {};
  for (const col of def.columns) {
    if (col.primaryKey === true) continue;
    cols[col.name] = mapColumnType(col.type);
  }
  if (def.localOnly === true) {
    return new Table(cols, { localOnly: true });
  }
  return new Table(cols);
}

/** Build a PowerSync Schema from one or more table registries (sync + localOnly). */
export function createPowerSyncSchema(
  ...registries: readonly TableRegistry[]
): Schema {
  const schemaTables: Record<string, Table> = {};
  for (const registry of registries) {
    for (const name of registry.tableNames()) {
      const def = registry.get(name);
      if (def === undefined) continue;
      if (schemaTables[def.tableName] !== undefined) {
        throw new Error(
          `createPowerSyncSchema: duplicate table ${def.tableName}`
        );
      }
      schemaTables[def.tableName] = toPowerSyncTable(def);
    }
  }
  return new Schema(schemaTables);
}
