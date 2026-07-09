import { Schema, Table, column, type BaseColumnType } from '@powersync/common';

import type { TableColumnType, TableDefinition } from '@pkgs/sync-engine/shared/table-definition';
import type { TableRegistry } from '@pkgs/sync-engine/shared/table-registry';

function mapColumnType(type: TableColumnType): BaseColumnType<string | number | null> {
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
  return new Table(cols);
}

export function createPowerSyncSchema(registry: TableRegistry): Schema {
  const schemaTables: Record<string, Table> = {};
  for (const name of registry.tableNames()) {
    const def = registry.get(name);
    if (def === undefined) continue;
    schemaTables[def.tableName] = toPowerSyncTable(def);
  }
  return new Schema(schemaTables);
}
