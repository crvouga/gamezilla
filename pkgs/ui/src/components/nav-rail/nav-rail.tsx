/**
 * `NavRail` -- app-agnostic vertical sidebar with header / body / footer slots.
 *
 * Designed for wide-layout chrome where a persistent rail flanks the main
 * content. The body slot is the flex-growing region; consumers typically
 * place a `ScrollView` here. Border and background come from the active
 * theme so the rail visually matches surrounding chrome.
 *
 * @example
 * ```tsx
 * <Box sx={{ flex: 1, flexDirection: 'row', minHeight: 0 }}>
 *   <NavRail
 *     header={<TopBar leading={<BackIconButton onPress={onBack} />} center={<Title />} />}
 *     footer={<RailFooterActions />}
 *   >
 *     <MemberList />
 *   </NavRail>
 *   <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>{mainContent}</Box>
 * </Box>
 * ```
 */

import type { ReactNode } from 'react';

import {
  componentDataSet,
  type ComponentDataSet,
} from '../../component-id';
import { Box } from '../box';

export const NAV_RAIL_DEFAULT_WIDTH = 276;

export type NavRailProps = {
  /** Pinned to the top of the rail (typically a `TopBar`). */
  header?: ReactNode;
  /** Pinned to the bottom of the rail (typically a row of actions). */
  footer?: ReactNode;
  /** Width of the rail in px. Defaults to {@link NAV_RAIL_DEFAULT_WIDTH}. */
  width?: number;
  /** Flex-growing body; receives a min-height-0 column container. */
  children: ReactNode;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function NavRail({
  header,
  footer,
  width = NAV_RAIL_DEFAULT_WIDTH,
  children,
  dataSet,
}: NavRailProps): ReactNode {
  return (
    <Box
      {...componentDataSet('NavRail', dataSet)}
      sx={{
        width,
        minHeight: 0,
        flexDirection: 'column',
        borderRightWidth: 1,
        borderColor: 'border',
        background: 'surface',
      }}
    >
      {header}
      <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
      {footer}
    </Box>
  );
}
