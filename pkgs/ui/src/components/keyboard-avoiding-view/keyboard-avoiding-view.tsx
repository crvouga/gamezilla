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
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import type { SxProps } from '../../theme';
import { useTheme } from '../../theme';

export type KeyboardAvoidingViewProps = RNKeyboardAvoidingViewProps & {
  sx?: SxProps;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export const KeyboardAvoidingView = forwardRef<
  RNKeyboardAvoidingView,
  KeyboardAvoidingViewProps
>(function KeyboardAvoidingView(
  { sx: sxProp, style, behavior: behaviorProp, dataSet, ...rest },
  ref
) {
  const theme = useTheme();
  const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
  const behavior =
    behaviorProp ?? (Platform.OS === 'ios' ? 'padding' : 'height');
  const idProps = componentDataSet('KeyboardAvoidingView', dataSet);

  return (
    <RNKeyboardAvoidingView
      ref={ref}
      style={[sxStyle, style]}
      behavior={behavior}
      {...rest}
      {...idProps}
    />
  );
});
