/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import { bindDataSet } from '../data-set-binding';
import type { ElementTargetProps } from '../element-targets';
import { bindElementTargets } from '../element-targets';
import { flexItemClass, spaced } from '../layout-classes';
import type { FlexItemProps, RegionProps } from '../layout-props';
import type { Responsive } from '../responsive';
import { responsiveClass, responsiveTable } from '../responsive';
import type { SpacingProps } from '../space-classes';
import { spacingClass } from '../space-classes';

export type GridColumns = 1 | 2 | 3 | 4 | 6 | 12;

/** Block-axis alignment of each cell's content. */
export type GridAlign = 'start' | 'center' | 'end' | 'stretch';

export type GridProps = SpacingProps &
  FlexItemProps &
  RegionProps &
  ElementTargetProps & {
    /** Number of equal columns. */
    columns: Responsive<GridColumns>;
    /** Default `stretch`: every cell in a row is as tall as the tallest. */
    align?: GridAlign | undefined;
    children?: JSX.Element | undefined;
  };

const COLUMNS = responsiveTable<GridColumns>({
  1: 'grid-cols-1 sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1',
  2: 'grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2',
  3: 'grid-cols-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3',
  4: 'grid-cols-4 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4',
  6: 'grid-cols-6 sm:grid-cols-6 md:grid-cols-6 lg:grid-cols-6 xl:grid-cols-6',
  12: 'grid-cols-12 sm:grid-cols-12 md:grid-cols-12 lg:grid-cols-12 xl:grid-cols-12',
});

const ALIGN: Readonly<Record<GridAlign, string>> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

function gridClass(grid: GridProps): string {
  return spaced([
    'box grid',
    responsiveClass(COLUMNS, grid.columns),
    grid.align === undefined ? undefined : ALIGN[grid.align],
    flexItemClass(grid),
    spacingClass(grid),
    grid.hidden === true ? 'hidden' : undefined,
  ]);
}

/**
 * `Grid` -- equal columns. `columns` is a count, per breakpoint when the
 * grid reflows; rows size to their content and `gap` separates both axes.
 * Like a stack it never paints and never carries meaning.
 *
 * @example
 * ```tsx
 * <Grid columns={{ base: 1, md: 2, xl: 3 }} gap="md">
 *   <For each={games()}>{(game) => <GameTile game={game} />}</For>
 * </Grid>
 * ```
 */
export function Grid(props: GridProps): JSX.Element {
  return (
    <div
      ref={(element) => {
        bindElementTargets(element, props);
        bindDataSet(element, props);
      }}
      class={gridClass(props)}
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('Grid')}
      role={props.role}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
      aria-live={props['aria-live']}
      aria-atomic={props['aria-atomic']}
      aria-busy={props['aria-busy']}
      aria-hidden={props['aria-hidden']}
      inert={props.inert === true ? true : undefined}
      hidden={props.hidden === true ? true : undefined}
    >
      {props.children}
    </div>
  );
}
