import type { ReactNode } from 'react';
import type { ComponentDataSet } from '../../component-id';
import type { SxInput } from '../../theme';

export type IslandSpan = 1 | 2 | 3;

export type IslandProps = {
  title?: ReactNode;
  caption?: ReactNode;
  /** Trailing actions in the title row (wide only). */
  actions?: ReactNode;
  /**
   * Column span inside {@link IslandGrid}. Compact ignores this.
   * Defaults to 1.
   */
  span?: IslandSpan;
  sx?: SxInput;
  children?: ReactNode;
  dataSet?: ComponentDataSet;
};
