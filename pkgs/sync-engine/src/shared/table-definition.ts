/** Column type for local SQLite / sync schema mapping. */
export type TableColumnType = 'text' | 'integer' | 'real';

export type TableColumnDefinition = {
  readonly name: string;
  readonly type: TableColumnType;
  readonly primaryKey?: boolean;
};

/** Public view names for sync `localOnly` tables must match this. */
export const LOCAL_ONLY_TABLE_NAME_RE = /^local_[a-z][a-z0-9_]*$/;

export type TableDefinition = {
  readonly tableName: string;
  readonly columns: readonly TableColumnDefinition[];
  /**
   * sync client-only table (never uploaded / never in sync streams).
   * Requires `tableName` matching {@link LOCAL_ONLY_TABLE_NAME_RE}.
   */
  readonly localOnly?: boolean;
};

export function assertLocalOnlyTableName(args: {
  readonly tableName: string;
  readonly localOnly: boolean;
}): void {
  const isLocalName = args.tableName.startsWith('local_');
  if (args.localOnly) {
    if (!LOCAL_ONLY_TABLE_NAME_RE.test(args.tableName)) {
      throw new Error(
        `defineTable: localOnly table "${args.tableName}" must match ${String(LOCAL_ONLY_TABLE_NAME_RE)}`
      );
    }
    return;
  }
  if (isLocalName) {
    throw new Error(
      `defineTable: table "${args.tableName}" uses local_ prefix but localOnly is not true`
    );
  }
}

export function defineTable(args: TableDefinition): TableDefinition {
  const localOnly = args.localOnly === true;
  assertLocalOnlyTableName({ tableName: args.tableName, localOnly });
  return Object.freeze({
    tableName: args.tableName,
    localOnly,
    columns: Object.freeze([...args.columns]),
  });
}

export function tableColumnNames(table: TableDefinition): readonly string[] {
  return table.columns.map((c) => c.name);
}
