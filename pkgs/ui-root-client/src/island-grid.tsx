/** @jsxImportSource solid-js */
/**
 * `IslandGrid` -- CSS grid of `Island`s on wide layouts (children set
 * `span`); a vertical stack on compact.
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { cssGap } from '@pkgs/ui-root-shared/css-px';
import { ISLAND_GAP_STEP } from '@pkgs/ui-root-shared/layout';
import type { JSX } from 'solid-js';
import { useLayoutMode } from './use-layout-mode';

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
    <div
      class="box"
      {...dataAttrs({ component: 'IslandGrid', ...props.dataSet })}
      style={
        mode() === 'wide'
          ? {
              display: 'grid',
              'grid-template-columns': `repeat(${props.columns}, minmax(0, 1fr))`,
              gap: cssGap(ISLAND_GAP_STEP),
              'align-items': 'stretch',
            }
          : { gap: cssGap(COMPACT_GAP_STEP) }
      }
    >
      {props.children}
    </div>
  );
}
