/** @jsxImportSource solid-js */
/**
 * `IslandGrid` -- CSS grid of `Island`s on wide layouts (children set
 * `span`); a vertical stack on compact.
 */

import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { ISLAND_GAP_STEP, useLayoutMode } from '../../theme';
import { Box } from '../box';

export type IslandGridColumns = 2 | 3;

export type IslandGridProps = {
  /** Column count on wide layouts. Compact always stacks vertically. */
  columns: IslandGridColumns;
  children: JSX.Element;
  dataSet?: ComponentDataSet | undefined;
};

const COMPACT_GAP_STEP = 3;

export function IslandGrid(props: IslandGridProps): JSX.Element {
  const mode = useLayoutMode();
  return (
    <Box
      sx={
        mode() === 'wide'
          ? {
              display: 'grid',
              gridTemplateColumns: `repeat(${props.columns}, minmax(0, 1fr))`,
              gap: ISLAND_GAP_STEP,
              alignItems: 'stretch',
            }
          : { gap: COMPACT_GAP_STEP }
      }
      dataSet={{ component: 'IslandGrid', ...props.dataSet }}
    >
      {props.children}
    </Box>
  );
}
