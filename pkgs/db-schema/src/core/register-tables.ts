import type { EnumDef } from './define-enum';
import { sealSchema, validateRuntime } from './define-schema';
import type { TableDef } from './define-table';
import type { ViewDef } from './define-view';
import type {
  CheckDef,
  DeclaredColumn,
  DeclaredEnum,
  DeclaredView,
  DeprecationDef,
  IndexDef,
  Schema,
} from './types';

export type SchemaMember = TableDef | ViewDef | EnumDef;

function mergeTableDefs(tables: readonly TableDef[]): {
  readonly literal: {
    tables: Record<string, Record<string, DeclaredColumn>>;
    indexes: readonly IndexDef[];
    uniqueIndexes: readonly IndexDef[];
    deprecations: readonly DeprecationDef[];
    checks: readonly CheckDef[];
    views: readonly DeclaredView[];
    enums: readonly DeclaredEnum[];
  };
  readonly domains: readonly string[];
} {
  const tableMap: Record<string, Record<string, DeclaredColumn>> = {};
  const indexes: IndexDef[] = [];
  const uniqueIndexes: IndexDef[] = [];
  const deprecations: DeprecationDef[] = [];
  const checks: CheckDef[] = [];
  const views: DeclaredView[] = [];
  const enums: DeclaredEnum[] = [];
  const domains = new Set<string>();

  for (const table of tables) {
    const { name, domain, _slice } = table;
    if (name in tableMap) {
      throw new Error(`registerTables: duplicate table '${name}'`);
    }
    domains.add(domain);
    tableMap[name] = { ..._slice.columns };
    indexes.push(..._slice.indexes);
    uniqueIndexes.push(..._slice.uniqueIndexes);
    deprecations.push(..._slice.deprecations);
    checks.push(..._slice.checks);
  }

  return {
    literal: {
      tables: tableMap,
      indexes,
      uniqueIndexes,
      deprecations,
      checks,
      views,
      enums,
    },
    domains: [...domains].sort(),
  };
}

/**
 * Compose registered {@link defineTable} results into an immutable {@link Schema}.
 */
export function registerTables(tables: readonly TableDef[]): Schema {
  const { literal, domains } = mergeTableDefs(tables);
  const declared = validateRuntime(literal, {
    tableNamePolicy: { domains },
  });
  return sealSchema(declared);
}

/** Sorted unique domain ids used when composing a schema. */
export function domainsFromTables(
  tables: readonly TableDef[]
): readonly string[] {
  const domains = new Set<string>();
  for (const table of tables) {
    domains.add(table.domain);
  }
  return [...domains].sort();
}

/**
 * Compose tables, views, and enums into an immutable {@link Schema}.
 */
export function registerSchema(members: readonly SchemaMember[]): Schema {
  const tables: TableDef[] = [];
  const views: ViewDef[] = [];
  const enums: EnumDef[] = [];
  for (const m of members) {
    if (m.kind === 'table') tables.push(m);
    else if (m.kind === 'view') views.push(m);
    else enums.push(m);
  }
  const { literal, domains } = mergeTableDefs(tables);
  const viewLiterals = views.map((v) => ({
    domain: v._view.domain,
    name: v._view.name,
    sql: v._view.sql,
    ...(v.deprecatedNote !== undefined ? { deprecated: v.deprecatedNote } : {}),
  }));
  const enumLiterals = enums.map((e) => ({
    domain: e._enum.domain,
    name: e._enum.name,
    values: e._enum.values,
    ...(e._enum.nativePostgres === true ? { nativePostgres: true } : {}),
    ...(e.deprecatedNote !== undefined ? { deprecated: e.deprecatedNote } : {}),
  }));
  const domainSet = new Set(domains);
  for (const v of views) domainSet.add(v.domain);
  for (const e of enums) domainSet.add(e.domain);
  const allDomains = [...domainSet].sort();
  const declared = validateRuntime(
    {
      ...literal,
      views: viewLiterals,
      enums: enumLiterals,
    },
    { tableNamePolicy: { domains: allDomains } }
  );
  return sealSchema(declared);
}

export function domainsFromSchemaMembers(
  members: readonly SchemaMember[]
): readonly string[] {
  const domains = new Set<string>();
  for (const m of members) {
    domains.add(m.domain);
  }
  return [...domains].sort();
}
