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
import {
  componentDataSet,
  type ComponentDataSet,
} from '../../component-id';
import { useTheme } from '../../theme';
import type { SxProps } from '../../theme';

export type ScrollViewProps = RNScrollViewProps & {
  /** Utility-first style shorthand applied to `contentContainerStyle`. */
  sx?: SxProps;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export const ScrollView = forwardRef<RNScrollView, ScrollViewProps>(
  function ScrollView(
    { sx: sxProp, contentContainerStyle, dataSet, ...rest },
    ref
  ) {
    const theme = useTheme();
    const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
    const idProps = componentDataSet('ScrollView', dataSet);
    return (
      <RNScrollView
        ref={ref}
        contentContainerStyle={[sxStyle, contentContainerStyle]}
        {...rest}
        {...idProps}
      />
    );
  }
);
