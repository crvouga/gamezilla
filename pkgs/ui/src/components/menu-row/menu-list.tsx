/**
 * `MenuList` -- full-bleed stack of {@link MenuRow}s for ScreenBase menu screens.
 *
 * Cancels the nearest shell's horizontal edge padding via
 * `useContentEdgePaddingStep` so rows span the full content width. Pass
 * `sx` to forward the ScreenBase `content` render-prop `sx` (e.g.
 * `{ flex: 1 }` on non-scroll bodies).
 *
 * @example
 * ```tsx
 * content={({ sx }) => (
 *   <MenuList sx={sx}>
 *     <MenuRow title="Account" onPress={goAccount} />
 *     <MenuRow title="Appearance" onPress={goTheme} />
 *   </MenuList>
 * )}
 * ```
 */

import type { ReactNode } from 'react';
import type { ComponentDataSet } from '../../component-id';
import type { SxInput } from '../../theme';
import { Box } from '../box';
import { useContentEdgePaddingStep } from '../content-edge-padding';
import { SCREEN_BODY_PADDING_STEP } from '../screen-base/screen-body-padding';

export type MenuListProps = {
  children: ReactNode;
  /** Forward ScreenBase `content` `sx` (e.g. `{ flex: 1 }`). */
  sx?: SxInput;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function MenuList({ children, sx, dataSet }: MenuListProps) {
  const edgeStep = useContentEdgePaddingStep() ?? SCREEN_BODY_PADDING_STEP;
  return (
    <Box
      sx={[sx, edgeStep !== 0 ? { mx: -edgeStep } : false]}
      dataSet={{ component: 'MenuList', ...dataSet }}
    >
      {children}
    </Box>
  );
}
