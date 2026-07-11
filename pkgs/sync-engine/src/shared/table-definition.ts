/** Column type for local SQLite / PowerSync schema mapping. */
export type TableColumnType = 'text' | 'integer' | 'real';

export type TableColumnDefinition = {
  readonly name: string;
  readonly type: TableColumnType;
  readonly primaryKey?: boolean;
};

export type TableDefinition = {
  readonly tableName: string;
  readonly columns: readonly TableColumnDefinition[];
};

export function defineTable(args: TableDefinition): TableDefinition {
  return Object.freeze({ ...args, columns: Object.freeze([...args.columns]) });
}

export function tableColumnNames(table: TableDefinition): readonly string[] {
  return table.columns.map((c) => c.name);
}
