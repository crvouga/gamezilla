/**
 * Themed `KeyboardAvoidingView` with optional `sx` on the outer container.
 * Platform-specific behavior is resolved inside this component.
 */

import { forwardRef } from 'react';
import {
  Platform,
  KeyboardAvoidingView as RNKeyboardAvoidingView,
  type KeyboardAvoidingViewProps as RNKeyboardAvoidingViewProps,
} from 'react-native';
import type { ComponentDataSet } from '../../component-id';
import { type SxInput, useHostSx } from '../../theme';

export type KeyboardAvoidingViewProps = Omit<
  RNKeyboardAvoidingViewProps,
  'style'
> & {
  sx?: SxInput;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export const KeyboardAvoidingView = forwardRef<
  RNKeyboardAvoidingView,
  KeyboardAvoidingViewProps
>(function KeyboardAvoidingView(
  { sx, behavior: behaviorProp, dataSet, ...rest },
  ref
) {
  const host = useHostSx('KeyboardAvoidingView', sx, dataSet);
  const behavior =
    behaviorProp ?? (Platform.OS === 'ios' ? 'padding' : 'height');

  return (
    <RNKeyboardAvoidingView
      ref={ref}
      style={host.style}
      behavior={behavior}
      {...rest}
      {...host.dataSet}
    />
  );
});
