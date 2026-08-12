/**
 * `SafeAreaView` -- themed safe-area container with `sx` prop.
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
import type { ComponentDataSet } from '../../component-id';
import { type SxInput, useHostSx } from '../../theme';

export type SafeAreaViewProps = Omit<ViewProps, 'style'> & {
  /** Utility-first style shorthand. */
  sx?: SxInput;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export const SafeAreaView = forwardRef<View, SafeAreaViewProps>(
  function SafeAreaView({ sx, dataSet, ...rest }, ref) {
    const host = useHostSx('SafeAreaView', sx, dataSet);
    return (
      <RNSafeAreaView
        ref={ref}
        style={host.style}
        {...rest}
        {...host.dataSet}
      />
    );
  }
);
