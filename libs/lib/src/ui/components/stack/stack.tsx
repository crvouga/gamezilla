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
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import type { SxProps } from '../../theme';
import { spacing as spacingScale } from '../../theme';

export type StackProps = ViewProps & {
  /** Layout axis. Defaults to `"vertical"`. */
  direction?: 'horizontal' | 'vertical';
  /** Gap between children in spacing-scale units. */
  spacing?: number;
  /** Cross-axis alignment. */
  align?: ViewStyle['alignItems'];
  /** Main-axis alignment. */
  justify?: ViewStyle['justifyContent'];
  /** Whether children should wrap. */
  wrap?: boolean;
  /** Utility-first style shorthand. */
  sx?: SxProps;
};

function resolveGap(n: number): number {
  return (spacingScale as Record<number, number>)[n] ?? n * 4;
}

export const Stack = forwardRef<View, StackProps>(function Stack(
  {
    direction = 'vertical',
    spacing: gap,
    align,
    justify,
    wrap,
    sx: sxProp,
    style,
    ...rest
  },
  ref
) {
  const theme = useTheme();

  const layoutStyle: ViewStyle = {
    flexDirection: direction === 'horizontal' ? 'row' : 'column',
  };
  if (gap !== undefined) layoutStyle.gap = resolveGap(gap);
  if (align) layoutStyle.alignItems = align;
  if (justify) layoutStyle.justifyContent = justify;
  if (wrap) layoutStyle.flexWrap = 'wrap';

  const sxStyle = sxProp ? theme.sx(sxProp) : undefined;

  return <View ref={ref} style={[layoutStyle, sxStyle, style]} {...rest} />;
});
