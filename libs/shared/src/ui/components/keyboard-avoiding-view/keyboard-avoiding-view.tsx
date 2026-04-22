/**
 * Themed `KeyboardAvoidingView` with optional `sx` on the outer container.
 * Platform-specific behavior is resolved inside this component.
 */

import { forwardRef } from 'react';
import {
  KeyboardAvoidingView as RNKeyboardAvoidingView,
  Platform,
  type KeyboardAvoidingViewProps as RNKeyboardAvoidingViewProps,
} from 'react-native';
import { useTheme } from '../../theme';
import type { SxProps } from '../../theme';

export type KeyboardAvoidingViewProps = RNKeyboardAvoidingViewProps & {
  sx?: SxProps;
};

export const KeyboardAvoidingView = forwardRef<
  RNKeyboardAvoidingView,
  KeyboardAvoidingViewProps
>(function KeyboardAvoidingView(
  { sx: sxProp, style, behavior: behaviorProp, ...rest },
  ref,
) {
  const theme = useTheme();
  const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
  const behavior =
    behaviorProp ??
    (Platform.OS === 'ios' ? 'padding' : 'height');

  return (
    <RNKeyboardAvoidingView
      ref={ref}
      style={[sxStyle, style]}
      behavior={behavior}
      {...rest}
    />
  );
});
