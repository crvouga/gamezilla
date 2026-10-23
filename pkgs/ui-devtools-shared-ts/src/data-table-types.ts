import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';

export type DataTableOrderDir = 'asc' | 'desc';

export type DataTableLoadPageParams = {
  readonly offset: number;
  readonly limit: number;
  readonly orderBy: string | null;
  readonly orderDir: DataTableOrderDir;
};

export type DataTableLoadPageResult<T> = {
  readonly rows: readonly T[];
  /** Total matching rows (for page count). */
  readonly totalCount: number;
};

export type DataTableLoadPage<T> = (
  params: DataTableLoadPageParams
) => Promise<DataTableLoadPageResult<T>>;

export type DataTableColumnAlign = 'start' | 'center' | 'end';

export type DataTableColumn<T> = {
  readonly id: string;
  readonly header: string;
  /** Minimum width in px. Leftover table width is distributed by the browser. */
  readonly width: number;
  readonly align?: DataTableColumnAlign;
  /** When true, the header is a sort button driving `orderBy = id`. */
  readonly sortable?: boolean;
  /** Fast path: primitive text cell (preferred). */
  readonly getValue?: (row: T) => string | number | null | undefined;
  /**
   * Escape hatch for Badge / IconButton / custom cells. Prefer `getValue`.
   * For row actions in compact density, prefer quiet IconButton (~28px),
   * not full Button chrome.
   */
  readonly cell?: (row: T) => JSX.Element;
};

export type DataTableDensity = 'compact' | 'comfortable';

export type DataTableSelectionMode = 'none' | 'multiple';

export type DataTableProps<T> = {
  readonly columns: readonly DataTableColumn<T>[];
  readonly loadPage: DataTableLoadPage<T>;
  readonly getRowId: (row: T, index: number) => string;
  /** Bust cache when the underlying dataset identity changes. */
  readonly sourceKey?: string | number | undefined;
  readonly pageSize?: number | undefined;
  readonly defaultOrderBy?: string | null | undefined;
  readonly defaultOrderDir?: DataTableOrderDir | undefined;
  readonly emptyTitle?: JSX.Element | undefined;
  readonly emptyBody?: JSX.Element | undefined;
  readonly onRowClick?: ((row: T) => void) | undefined;
  readonly density?: DataTableDensity | undefined;
  /**
   * Controlled multi-select. When `"multiple"`, pass `selectedKeys` and
   * `onSelectedKeysChange` (parent owns selection state).
   */
  readonly selectionMode?: DataTableSelectionMode | undefined;
  readonly selectedKeys?: readonly string[] | undefined;
  readonly onSelectedKeysChange?:
    | ((keys: readonly string[]) => void)
    | undefined;
  readonly class?: string | undefined;
  readonly style?: JSX.CSSProperties | string | undefined;
  readonly dataSet?: ComponentDataSet | undefined;
};

export type DataTablePageCacheEntry<T> =
  | {
      readonly status: 'ready';
      readonly rows: readonly T[];
      readonly totalCount: number;
    }
  | {
      readonly status: 'error';
      readonly message: string;
    };
