/**
 * `TextInput` -- styled text input with label, error, and helper text.
 *
 * @example
 * ```tsx
 * <TextInput
 *   label="Email"
 *   placeholder="you@example.com"
 *   value={email}
 *   onChangeText={setEmail}
 *   error={!valid ? 'Invalid email' : undefined}
 * />
 * ```
 */

import { forwardRef } from 'react';
import {
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
  View,
} from 'react-native';
import { useTheme } from '../../theme';
import type { SxProps } from '../../theme';
import { Text } from '../text';

export type TextInputProps = Omit<RNTextInputProps, 'style'> & {
  /** Label shown above the input. */
  label?: string;
  /** Error message shown below the input. */
  error?: string;
  /** Helper text shown below the input (hidden when error is present). */
  helperText?: string;
  /** Utility-first style shorthand for the outer wrapper. */
  sx?: SxProps;
};

export const TextInput = forwardRef<RNTextInput, TextInputProps>(
  function TextInput({ label, error, helperText, sx: sxProp, ...rest }, ref) {
    const theme = useTheme();
    const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
    const borderColor = error ? theme.colors.destructive : theme.colors.border;

    return (
      <View style={[{ gap: 4 }, sxStyle]}>
        {label && <Text variant="label" label={label} />}
        <RNTextInput
          ref={ref}
          placeholderTextColor={theme.colors.disabled}
          style={[
            theme.sx({
              py: 2.5,
              px: 3,
              fontSize: 'base',
              borderRadius: 8,
              borderWidth: 1,
            }),
            {
              color: theme.colors.text,
              borderColor,
              backgroundColor: theme.colors.paper,
            },
          ]}
          {...rest}
        />
        {error ? (
          <Text variant="caption" sx={{ color: 'destructive' }} label={error} />
        ) : helperText ? (
          <Text variant="caption" label={helperText} />
        ) : null}
      </View>
    );
  },
);
