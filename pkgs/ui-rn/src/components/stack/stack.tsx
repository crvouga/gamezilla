/**
 * `Stack` -- flex container with direction and spacing.
 *
 * Lays out children along a single axis with consistent gap.
 * Use `direction="horizontal"` for rows, `"vertical"` (default) for columns.
 *
 * @example
 * ```tsx
 * <Stack direction="horizontal" spacing={2} align="center">
 *   <Avatar />
 *   <Text>Username</Text>
 * </Stack>
 * ```
 */

import { forwardRef } from 'react';
import type { View } from 'react-native';
import type { ComponentDataSet } from '../../component-id';
import type { SxAlign, SxInput, SxJustify, SxProps } from '../../theme';
import { Box, type BoxProps } from '../box';

export type StackProps = Omit<BoxProps, 'sx'> & {
  /** Layout axis. Defaults to `"vertical"`. */
  direction?: 'horizontal' | 'vertical';
  /** Gap between children in spacing-scale units. */
  spacing?: number;
  /** Cross-axis alignment. */
  align?: SxAlign;
  /** Main-axis alignment. */
  justify?: SxJustify;
  /** Whether children should wrap. */
  wrap?: boolean;
  /** Utility-first style shorthand. */
  sx?: SxInput;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

function layoutSx(args: {
  direction: 'horizontal' | 'vertical';
  spacing: number | undefined;
  align: SxAlign | undefined;
  justify: SxJustify | undefined;
  wrap: boolean | undefined;
}): SxProps {
  const sx: SxProps = {
    flexDirection: args.direction === 'horizontal' ? 'row' : 'column',
  };
  if (args.spacing !== undefined) sx.gap = args.spacing;
  if (args.align) sx.alignItems = args.align;
  if (args.justify) sx.justifyContent = args.justify;
  if (args.wrap) sx.flexWrap = 'wrap';
  return sx;
}

export const Stack = forwardRef<View, StackProps>(function Stack(
  {
    direction = 'vertical',
    spacing,
    align,
    justify,
    wrap,
    sx,
    dataSet,
    ...rest
  },
  ref
) {
  return (
    <Box
      ref={ref}
      sx={[layoutSx({ direction, spacing, align, justify, wrap }), sx]}
      dataSet={{ component: 'Stack', ...dataSet }}
      {...rest}
    />
  );
});
