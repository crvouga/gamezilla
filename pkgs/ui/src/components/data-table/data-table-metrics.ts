import type { DataTableColumn, DataTableDensity } from './data-table-types';

export const DATA_TABLE_ROW_HEIGHT: Record<DataTableDensity, number> = {
  compact: 36,
  comfortable: 44,
};

export const DATA_TABLE_HEADER_HEIGHT = 36;

/** Horizontal padding on each side of header/row content. */
export const DATA_TABLE_ROW_PAD_X = 12;

export function sumColumnWidths<T>(
  columns: readonly DataTableColumn<T>[]
): number {
  let total = 0;
  for (const col of columns) {
    total += col.width;
  }
  return total;
}

/**
 * Resolve pixel widths that fill at least `frameWidth`.
 * Declared column widths are minimums; leftover space is distributed
 * proportionally so the grid never leaves an empty band on the right.
 */
export function resolveColumnLayout<T>(
  columns: readonly DataTableColumn<T>[],
  frameWidth: number
): { readonly tableWidth: number; readonly widths: readonly number[] } {
  const base = sumColumnWidths(columns);
  const pad = DATA_TABLE_ROW_PAD_X * 2;
  const minOuter = base + pad;
  const outer = Math.max(minOuter, frameWidth > 0 ? frameWidth : minOuter);
  const content = Math.max(0, outer - pad);
  if (columns.length === 0) {
    return { tableWidth: outer, widths: [] };
  }
  if (content <= base || base === 0) {
    return {
      tableWidth: outer,
      widths: columns.map((c) => c.width),
    };
  }
  const widths: number[] = [];
  let assigned = 0;
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (col == null) continue;
    if (i === columns.length - 1) {
      widths.push(content - assigned);
      break;
    }
    const w = Math.floor((content * col.width) / base);
    widths.push(w);
    assigned += w;
  }
  return { tableWidth: outer, widths };
}

export function pageCacheKey(
  orderBy: string | null,
  orderDir: string,
  offset: number,
  limit: number
): string {
  return `${orderBy ?? ''}:${orderDir}:${offset}:${limit}`;
}
