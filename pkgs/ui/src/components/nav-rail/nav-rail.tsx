/** @jsxImportSource solid-js */
import { cssPx } from '../../css/css-px';
/** `NavRail` -- fixed-width side column with pinned header / footer slots. */

import type { JSX } from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';

export const NAV_RAIL_DEFAULT_WIDTH = 276;

export type NavRailProps = {
  /** Pinned to the top of the rail (typically a `TopBar`). */
  header?: JSX.Element | undefined;
  /** Pinned to the bottom of the rail (typically a row of actions). */
  footer?: JSX.Element | undefined;
  /** Width of the rail in px. Defaults to {@link NAV_RAIL_DEFAULT_WIDTH}. */
  width?: number | undefined;
  /** Flex-growing body; receives a min-height-0 column container. */
  children: JSX.Element;
  dataSet?: ComponentDataSet | undefined;
};

export function NavRail(props: NavRailProps): JSX.Element {
  return (
    <nav
      class="box min-h-[0] flex-col border-r border-solid border-border bg-surface"
      {...dataAttrs({ component: 'NavRail', ...props.dataSet })}
      style={{ width: cssPx(props.width ?? NAV_RAIL_DEFAULT_WIDTH) }}
    >
      {props.header}
      <div class="box flex-1 min-h-[0]">{props.children}</div>
      {props.footer}
    </nav>
  );
}
