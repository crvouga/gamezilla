export const DEFAULT_PAGE_SIZE = 100;
export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;

export type TableBrowse = {
  readonly kind: 'table' | 'view';
  readonly name: string;
  /** 0-based page index. */
  readonly page: number;
  readonly pageSize: number;
};

/** Double-quote a SQLite identifier, escaping embedded quotes. */
export function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

export function buildTablePageSql(args: {
  readonly name: string;
  readonly page: number;
  readonly pageSize: number;
}): string {
  const page = Math.max(0, Math.floor(args.page));
  const pageSize = Math.max(1, Math.floor(args.pageSize));
  const offset = page * pageSize;
  return `SELECT * FROM ${quoteIdent(args.name)} LIMIT ${pageSize} OFFSET ${offset};`;
}

export function buildTableCountSql(name: string): string {
  return `SELECT COUNT(*) AS n FROM ${quoteIdent(name)};`;
}

export function pageCount(totalRows: number, pageSize: number): number {
  const size = Math.max(1, pageSize);
  if (totalRows <= 0) return 1;
  return Math.ceil(totalRows / size);
}

export function pageRangeLabel(args: {
  readonly page: number;
  readonly pageSize: number;
  readonly totalRows: number;
  readonly rowCount: number;
}): string {
  const { page, pageSize, totalRows, rowCount } = args;
  if (totalRows <= 0 || rowCount <= 0) return '0 rows';
  const start = page * pageSize + 1;
  const end = page * pageSize + rowCount;
  return `${start}–${end} of ${totalRows}`;
}

export function indexInspectSql(name: string): string {
  const escaped = name.replaceAll("'", "''");
  return `SELECT * FROM sqlite_master WHERE type='index' AND name='${escaped}';`;
}
