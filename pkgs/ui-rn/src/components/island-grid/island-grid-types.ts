import type { ReactNode } from 'react';
import type { ComponentDataSet } from '../../component-id';

export type IslandGridColumns = 2 | 3;

export type IslandGridProps = {
  /** Column count on wide layouts. Compact always stacks vertically. */
  columns: IslandGridColumns;
  children: ReactNode;
  dataSet?: ComponentDataSet;
};
