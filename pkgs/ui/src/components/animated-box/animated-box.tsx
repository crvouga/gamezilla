/**
 * `AnimatedBox` -- `Box` backed by React Native `Animated.View`.
 *
 * Accepts the same `sx` language; animated nodes in numeric fields are
 * passed through to the host. CSS capture snapshots current values when
 * `__getValue` is present.
 */

import { type ComponentProps, forwardRef } from 'react';
import { Animated, type View } from 'react-native';
import type { ComponentDataSet } from '../../component-id';
import { type SxInput, useHostSx } from '../../theme';

export type AnimatedBoxProps = Omit<
  ComponentProps<typeof Animated.View>,
  'style'
> & {
  sx?: SxInput;
  dataSet?: ComponentDataSet;
};

export const AnimatedBox = forwardRef<View, AnimatedBoxProps>(
  function AnimatedBox({ sx, dataSet, ...rest }, ref) {
    const host = useHostSx('AnimatedBox', sx, dataSet);
    return (
      <Animated.View ref={ref} style={host.style} {...rest} {...host.dataSet} />
    );
  }
);
