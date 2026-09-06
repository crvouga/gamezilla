import type {
  DataTableLoadPage,
  DataTableLoadPageParams,
  DataTableOrderDir,
} from './data-table-types';

/**
 * Builds a `loadPage` that pages/sorts an in-memory snapshot from `getRows`.
 * Use for examples and transitional call sites — prefer a real remote/SQL
 * loader when the dataset is not already fully loaded.
 */
export function createMemoryPageLoader<T>(
  getRows: () => readonly T[],
  compare?: (a: T, b: T, orderBy: string, orderDir: DataTableOrderDir) => number
): DataTableLoadPage<T> {
  return (params: DataTableLoadPageParams) => {
    const { offset, limit, orderBy, orderDir } = params;
    const rows = [...getRows()];
    if (orderBy != null && compare != null) {
      rows.sort((a, b) => compare(a, b, orderBy, orderDir));
    }
    const totalCount = rows.length;
    const page = rows.slice(offset, offset + limit);
    return Promise.resolve({ rows: page, totalCount });
  };
}
