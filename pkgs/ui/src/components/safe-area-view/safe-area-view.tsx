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
  type View,
  type ViewProps,
} from 'react-native';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import type { SxProps } from '../../theme';
import { useTheme } from '../../theme';

export type SafeAreaViewProps = ViewProps & {
  /** Utility-first style shorthand. */
  sx?: SxProps;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export const SafeAreaView = forwardRef<View, SafeAreaViewProps>(
  function SafeAreaView({ sx: sxProp, style, dataSet, ...rest }, ref) {
    const theme = useTheme();
    const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
    const idProps = componentDataSet('SafeAreaView', dataSet);
    return (
      <RNSafeAreaView
        ref={ref}
        style={[sxStyle, style]}
        {...rest}
        {...idProps}
      />
    );
  }
);
