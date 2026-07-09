import type { TableDefinition } from './table-definition';

export type TableRegistry = {
  readonly tables: ReadonlyMap<string, TableDefinition>;
  get(tableName: string): TableDefinition | undefined;
  tableNames(): readonly string[];
};

export function createTableRegistry(
  definitions: readonly TableDefinition[]
): TableRegistry {
  const tables = new Map<string, TableDefinition>();
  for (const def of definitions) {
    if (tables.has(def.tableName)) {
      throw new Error(
        `createTableRegistry: duplicate table ${def.tableName}`
      );
    }
    tables.set(def.tableName, def);
  }
  return {
    tables,
    get: (name) => tables.get(name),
    tableNames: () => [...tables.keys()],
  };
}
