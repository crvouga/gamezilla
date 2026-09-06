/** @jsxImportSource solid-js */
/** `NavRail` -- fixed-width side column with pinned header / footer slots. */

import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';

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
    <Box
      as="nav"
      dataSet={{ component: 'NavRail', ...props.dataSet }}
      sx={{
        width: props.width ?? NAV_RAIL_DEFAULT_WIDTH,
        minHeight: 0,
        flexDirection: 'column',
        borderRightWidth: 1,
        borderStyle: 'solid',
        borderColor: 'border',
        background: 'surface',
      }}
    >
      {props.header}
      <Box sx={{ flex: 1, minHeight: 0 }}>{props.children}</Box>
      {props.footer}
    </Box>
  );
}
