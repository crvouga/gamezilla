/**
 * `ScrollView` -- themed scrollable container with `sx` prop.
 *
 * @example
 * ```tsx
 * <ScrollView sx={{ flex: 1, p: 4 }}>
 *   <Text>Scrollable content</Text>
 * </ScrollView>
 * ```
 */

import { forwardRef } from 'react';
import {
  ScrollView as RNScrollView,
  type ScrollViewProps as RNScrollViewProps,
} from 'react-native';
import { useTheme } from '../../theme';
import type { SxProps } from '../../theme';

export type ScrollViewProps = RNScrollViewProps & {
  /** Utility-first style shorthand applied to `contentContainerStyle`. */
  sx?: SxProps;
};

export const ScrollView = forwardRef<RNScrollView, ScrollViewProps>(
  function ScrollView({ sx: sxProp, contentContainerStyle, ...rest }, ref) {
    const theme = useTheme();
    const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
    return (
      <RNScrollView
        ref={ref}
        contentContainerStyle={[sxStyle, contentContainerStyle]}
        {...rest}
      />
    );
  }
);
