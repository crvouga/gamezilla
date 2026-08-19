import { sealSchema, validateRuntime } from './define-schema';
import type { TableDef } from './define-table';
import type { Schema } from './types';

function mergeTableDefs(tables: readonly TableDef[]): {
  readonly literal: {
    tables: Record<string, Record<string, import('./types').ColumnType>>;
    indexes: readonly (readonly [string, ...string[]])[];
    uniqueIndexes: readonly (readonly [string, ...string[]])[];
    deprecations: readonly (
      | readonly [string, string]
      | readonly [string, string, string]
    )[];
  };
  readonly domains: readonly string[];
} {
  const tableMap: Record<
    string,
    Record<string, import('./types').ColumnType>
  > = {};
  const indexes: (readonly [string, ...string[]])[] = [];
  const uniqueIndexes: (readonly [string, ...string[]])[] = [];
  const deprecations: (
    | readonly [string, string]
    | readonly [string, string, string]
  )[] = [];
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
  }

  return {
    literal: {
      tables: tableMap,
      indexes,
      uniqueIndexes,
      deprecations,
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
