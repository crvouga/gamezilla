/**
 * `Box` -- the foundational layout primitive.
 *
 * A themed `View` that accepts an `sx` prop for utility-first styling
 * and resolves color tokens from the current theme.
 *
 * @example
 * ```tsx
 * <Box sx={{ p: 4, background: 'paper', borderRadius: 8 }}>
 *   <Text>Hello</Text>
 * </Box>
 * ```
 */

import { forwardRef } from 'react';
import { View, type ViewProps } from 'react-native';
import { useTheme, type SxProps } from '@gamezilla/shared/theme';

export type BoxProps = ViewProps & {
  /** Utility-first style shorthand resolved against the current theme. */
  sx?: SxProps;
};

export const Box = forwardRef<View, BoxProps>(function Box(
  { sx: sxProp, style, ...rest },
  ref,
) {
  const theme = useTheme();
  const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
  return <View ref={ref} style={[sxStyle, style]} {...rest} />;
});
