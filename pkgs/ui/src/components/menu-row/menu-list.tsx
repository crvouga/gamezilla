/**
 * `MenuList` -- full-bleed stack of {@link MenuRow}s for ScreenBase menu screens.
 *
 * Cancels ScreenBase body horizontal padding (`p: 4` / 16px) via
 * `mx: -SCREEN_BODY_PADDING_STEP` so rows span the full content width. Pass
 * `style` to forward the ScreenBase `content` render-prop `sx` (e.g.
 * `{ flex: 1 }` on non-scroll bodies).
 *
 * @example
 * ```tsx
 * content={({ sx }) => (
 *   <MenuList style={sx}>
 *     <MenuRow title="Account" onPress={goAccount} />
 *     <MenuRow title="Appearance" onPress={goTheme} />
 *   </MenuList>
 * )}
 * ```
 */

import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { Box } from '../box';
import { SCREEN_BODY_PADDING_STEP } from '../screen-base/screen-body-padding';

export type MenuListProps = {
  children: ReactNode;
  /** Forward ScreenBase `content` `sx` (e.g. `{ flex: 1 }`). */
  style?: ViewProps['style'];
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function MenuList({ children, style, dataSet }: MenuListProps) {
  return (
    <Box
      style={style}
      sx={{ mx: -SCREEN_BODY_PADDING_STEP }}
      {...componentDataSet('MenuList', dataSet)}
    >
      {children}
    </Box>
  );
}
