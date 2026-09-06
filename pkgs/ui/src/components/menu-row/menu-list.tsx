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

import { Children, type ReactNode } from 'react';
import type { ComponentDataSet } from '../../component-id';
import type { SxInput } from '../../theme';
import { Box } from '../box';
import { useContentEdgePaddingStep } from '../content-edge-padding';
import { SCREEN_BODY_PADDING_STEP } from '../screen-base/screen-body-padding';
import { MENU_ROW_PX_STEP } from './menu-row';

export type MenuListProps = {
  children: ReactNode;
  /** Forward ScreenBase `content` `sx` (e.g. `{ flex: 1 }`). */
  sx?: SxInput;
  /** Hairline separators between rows. Defaults to `true`. */
  separator?: boolean;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

/** Separator inset matches `MenuRow`'s horizontal padding. */
const SEPARATOR_INSET_STEP = MENU_ROW_PX_STEP;

export function MenuList({
  children,
  sx,
  separator = true,
  dataSet,
}: MenuListProps) {
  const edgeStep = useContentEdgePaddingStep() ?? SCREEN_BODY_PADDING_STEP;
  const rows = Children.toArray(children);
  return (
    <Box
      sx={[sx, edgeStep !== 0 ? { mx: -edgeStep } : false]}
      dataSet={{ component: 'MenuList', ...dataSet }}
    >
      {rows.map((child, index) => (
        <Box key={index}>
          {child}
          {separator && index < rows.length - 1 ? (
            <Box
              sx={{
                borderBottomWidth: 'hairline',
                borderColor: 'border',
                mx: SEPARATOR_INSET_STEP,
              }}
            />
          ) : null}
        </Box>
      ))}
    </Box>
  );
}
