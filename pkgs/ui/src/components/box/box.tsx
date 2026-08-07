/**
 * `Box` -- the foundational layout primitive.
 *
 * A themed `View` that accepts an `sx` prop for utility-first styling
 * and resolves color tokens from the current theme.
 *
 * @example
 * ```tsx
 * <Box sx={{ p: 4, background: 'surface', borderRadius: 8 }}>
 *   <Text>Hello</Text>
 * </Box>
 * ```
 */

import { forwardRef } from 'react';
import { View, type ViewProps } from 'react-native';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import type { SxProps } from '../../theme';
import { useTheme } from '../../theme';

export type BoxProps = ViewProps & {
  /** Utility-first style shorthand resolved against the current theme. */
  sx?: SxProps;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export const Box = forwardRef<View, BoxProps>(function Box(
  { sx: sxProp, style, dataSet, ...rest },
  ref
) {
  const theme = useTheme();
  const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
  const idProps = componentDataSet('Box', dataSet);
  return <View ref={ref} style={[sxStyle, style]} {...rest} {...idProps} />;
});
