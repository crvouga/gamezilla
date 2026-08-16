import type { ReactNode } from 'react';

import type { ComponentDataSet } from '../../component-id';
import type { SxProps } from '../../theme';

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
  /** Minimum width in px. Leftover frame space is distributed proportionally. */
  readonly width: number;
  readonly align?: DataTableColumnAlign;
  /** When true, header press drives `orderBy = id`. */
  readonly sortable?: boolean;
  /** Fast path: primitive text cell (preferred). */
  readonly getValue?: (row: T) => string | number | null | undefined;
  /** Escape hatch for Badge / Button / custom cells. Prefer `getValue`. */
  readonly cell?: (row: T) => ReactNode;
};

export type DataTableDensity = 'compact' | 'comfortable';

export type DataTableProps<T> = {
  readonly columns: readonly DataTableColumn<T>[];
  readonly loadPage: DataTableLoadPage<T>;
  readonly getRowId: (row: T, index: number) => string;
  /** Bust cache when the underlying dataset identity changes. */
  readonly sourceKey?: string | number;
  readonly pageSize?: number;
  readonly defaultOrderBy?: string | null;
  readonly defaultOrderDir?: DataTableOrderDir;
  readonly emptyTitle?: ReactNode;
  readonly emptyBody?: ReactNode;
  readonly onRowPress?: (row: T) => void;
  readonly density?: DataTableDensity;
  readonly frameSx?: SxProps;
  readonly sx?: SxProps;
  readonly dataSet?: ComponentDataSet;
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
