/**
 * `SafeAreaView` -- themed safe-area container with `sx` prop.
 *
 * Wraps React Native `SafeAreaView` to respect device insets.
 *
 * @example
 * ```tsx
 * <SafeAreaView sx={{ flex: 1, background: 'surface' }}>
 *   <Text>Safe content</Text>
 * </SafeAreaView>
 * ```
 */

import { forwardRef } from 'react';
import {
  SafeAreaView as RNSafeAreaView,
  type ViewProps,
  type View,
} from 'react-native';
import { useTheme } from '../../theme';
import type { SxProps } from '../../theme';

export type SafeAreaViewProps = ViewProps & {
  /** Utility-first style shorthand. */
  sx?: SxProps;
};

export const SafeAreaView = forwardRef<View, SafeAreaViewProps>(
  function SafeAreaView({ sx: sxProp, style, ...rest }, ref) {
    const theme = useTheme();
    const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
    return <RNSafeAreaView ref={ref} style={[sxStyle, style]} {...rest} />;
  },
);
