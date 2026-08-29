import { classifyDelta, desiredColumns, findColumn } from './compatibility';
import { POSTGRES_CAPS } from './dialect-caps';
import { resolveDialectSql } from './dialect-sql';
import {
  asPackageIndexName,
  asValidatedIdent,
  fingerprintForIndexDef,
} from './index-fingerprint';
import { resolveBackfillSql } from './lifecycle';
import type {
  CreateTableColumn,
  PlanServerResult,
  ServerOperation,
} from './operations';
import type {
  DeclaredColumn,
  IndexDef,
  IntrospectedCatalog,
  ReadonlyDeclaredSchema,
} from './types';
import {
  MANAGED_IMPLICIT_COLUMN_NAMES,
  MANAGED_IMPLICIT_COLUMNS,
} from './types';

function createTableColumns(
  declared: ReadonlyDeclaredSchema,
  table: string
): CreateTableColumn[] {
  const columns: CreateTableColumn[] = [];
  for (const name of MANAGED_IMPLICIT_COLUMN_NAMES) {
    columns.push({
      name: asValidatedIdent(name),
      type: MANAGED_IMPLICIT_COLUMNS[name],
      isPrimaryKey: name === 'id',
    });
  }
  for (const [name, col] of Object.entries(declared.tables[table]!)) {
    columns.push(toCreateColumn(name, col));
  }
  return columns;
}

function toCreateColumn(name: string, col: DeclaredColumn): CreateTableColumn {
  return {
    name: asValidatedIdent(name),
    type: col.type,
    isPrimaryKey: false,
    ...(col.physicalPostgres !== undefined
      ? { physicalPostgres: col.physicalPostgres }
      : {}),
    ...(col.physicalSqlite !== undefined
      ? { physicalSqlite: col.physicalSqlite }
      : {}),
    ...(col.generated !== undefined
      ? {
          generatedExpr: resolveDialectSql(col.generated.expr, 'postgres'),
          generatedStored: col.generated.stored,
        }
      : {}),
    ...(col.references !== undefined
      ? {
          references: {
            table: asValidatedIdent(col.references.table),
            column: asValidatedIdent(col.references.column),
          },
        }
      : {}),
  };
}

function planIndexOps(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog
): ServerOperation[] {
  const ops: ServerOperation[] = [];
  const desiredIndexNames = new Set<string>();

  const pushCreate = (def: IndexDef, unique: boolean): void => {
    const name = fingerprintForIndexDef(def, unique);
    desiredIndexNames.add(name);
    if (catalog.indexes.some((ix) => ix.name === name)) return;
    const [table, ...columns] = def;
    ops.push({
      kind: 'create_index',
      name,
      table: asValidatedIdent(table),
      columns: columns.map(asValidatedIdent),
      unique,
    });
  };

  for (const def of declared.indexes) {
    pushCreate(def, false);
  }
  for (const def of declared.uniqueIndexes) {
    pushCreate(def, true);
  }

  for (const ix of catalog.indexes) {
    const branded = asPackageIndexName(ix.name);
    if (!branded || desiredIndexNames.has(branded)) continue;
    ops.push({ kind: 'drop_index', name: branded });
  }
  return ops;
}

function planColumnAdds(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog
): ServerOperation[] {
  const ops: ServerOperation[] = [];
  for (const tableName of Object.keys(declared.tables)) {
    const existing = catalog.tables.get(tableName);
    if (!existing) {
      ops.push({
        kind: 'create_table',
        table: asValidatedIdent(tableName),
        columns: createTableColumns(declared, tableName),
      });
      continue;
    }
    const desired = desiredColumns(declared, tableName);
    for (const [colName, col] of desired) {
      if (findColumn(existing, colName)) continue;
      ops.push({
        kind: 'add_column',
        table: asValidatedIdent(tableName),
        column: asValidatedIdent(colName),
        type: col.type,
        ...(col.physicalPostgres !== undefined
          ? { physicalPostgres: col.physicalPostgres }
          : {}),
      });
      const expr = resolveBackfillSql(col, 'postgres');
      if (expr !== null) {
        ops.push({
          kind: 'backfill',
          table: asValidatedIdent(tableName),
          column: asValidatedIdent(colName),
          expression: expr,
        });
      }
    }
  }
  return ops;
}

function planChecksAndFks(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog
): ServerOperation[] {
  const ops: ServerOperation[] = [];
  const existingChecks = new Set(
    (catalog.checks ?? []).map((c) => `${c.table}.${c.name}`)
  );
  for (const check of declared.checks) {
    if (existingChecks.has(`${check.table}.${check.name}`)) continue;
    const expr =
      typeof check.sql === 'string'
        ? check.sql
        : (check.sql.postgres ?? check.sql.sql);
    ops.push({
      kind: 'add_check',
      name: asValidatedIdent(check.name),
      table: asValidatedIdent(check.table),
      expression: expr,
    });
  }
  const existingFks = new Set(
    (catalog.foreignKeys ?? []).map(
      (f) => `${f.table}.${f.column}->${f.refTable}.${f.refColumn}`
    )
  );
  for (const [tableName, cols] of Object.entries(declared.tables)) {
    for (const [colName, col] of Object.entries(cols)) {
      if (col.references === undefined) continue;
      const key = `${tableName}.${colName}->${col.references.table}.${col.references.column}`;
      if (existingFks.has(key)) continue;
      ops.push({
        kind: 'add_foreign_key',
        name: asValidatedIdent(`fk_${tableName}_${colName}`.slice(0, 63)),
        table: asValidatedIdent(tableName),
        column: asValidatedIdent(colName),
        refTable: asValidatedIdent(col.references.table),
        refColumn: asValidatedIdent(col.references.column),
      });
    }
  }
  return ops;
}

function planViews(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog
): ServerOperation[] {
  const ops: ServerOperation[] = [];
  const existingViews = new Set((catalog.views ?? []).map((v) => v.name));
  for (const view of declared.views) {
    if (declared.deprecatedViews.has(view.name)) continue;
    const expr =
      typeof view.sql === 'string'
        ? view.sql
        : (view.sql.postgres ?? view.sql.sql);
    ops.push({
      kind: existingViews.has(view.name) ? 'replace_view' : 'create_view',
      name: asValidatedIdent(view.name),
      expression: expr,
    });
  }
  return ops;
}

function planEnums(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog
): ServerOperation[] {
  const ops: ServerOperation[] = [];
  const existingEnums = new Map(
    (catalog.enums ?? []).map((e) => [e.name, e.values] as const)
  );
  for (const en of declared.enums) {
    if (declared.deprecatedEnums.has(en.name)) continue;
    const existing = existingEnums.get(en.name);
    if (!existing) {
      ops.push({
        kind: 'create_enum',
        name: asValidatedIdent(en.name),
        values: en.values,
        nativePostgres: en.nativePostgres === true,
      });
      continue;
    }
    for (const value of en.values) {
      if (existing.includes(value)) continue;
      ops.push({
        kind: 'add_enum_value',
        name: asValidatedIdent(en.name),
        value,
      });
    }
  }
  return ops;
}

function planViewsAndEnums(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog
): ServerOperation[] {
  return [...planViews(declared, catalog), ...planEnums(declared, catalog)];
}

function enumRemovalDrift(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog
): import('./types').DriftError[] {
  const drift: import('./types').DriftError[] = [];
  const existingEnums = new Map(
    (catalog.enums ?? []).map((e) => [e.name, e.values] as const)
  );
  for (const en of declared.enums) {
    if (en.nativePostgres !== true) continue;
    const existing = existingEnums.get(en.name);
    if (!existing) continue;
    for (const old of existing) {
      if (!en.values.includes(old)) {
        drift.push({
          path: en.name,
          message: `cannot remove enum value '${old}' on Postgres (expand-only)`,
        });
      }
    }
  }
  return drift;
}

export function planServer(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog
): PlanServerResult {
  const classified = classifyDelta({
    declared,
    catalog,
    caps: POSTGRES_CAPS,
    mode: 'postgres',
  });
  const enumDrift = enumRemovalDrift(declared, catalog);
  const drift = [...classified.drift, ...enumDrift];
  if (drift.length > 0) {
    return { ok: false, drift };
  }
  const operations: ServerOperation[] = [
    ...planColumnAdds(declared, catalog),
    ...planChecksAndFks(declared, catalog),
    ...planViewsAndEnums(declared, catalog),
    ...planIndexOps(declared, catalog),
  ];
  return { ok: true, operations };
}
