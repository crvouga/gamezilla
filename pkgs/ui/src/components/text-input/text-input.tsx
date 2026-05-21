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

import type { LocalizedString } from '@gamezilla/i18n';
import { forwardRef, type ReactNode } from 'react';
import {
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
  View,
} from 'react-native';
import type { SxProps } from '../../theme';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Text } from '../text';

export type TextInputProps = Omit<
  RNTextInputProps,
  'style' | 'placeholder' | 'accessibilityLabel'
> & {
  /** Label shown above the input. */
  label?: ReactNode;
  /** Error message shown below the input. */
  error?: LocalizedString;
  /** Helper text shown below the input (hidden when error is present). */
  helperText?: LocalizedString;
  placeholder?: LocalizedString;
  accessibilityLabel?: LocalizedString;
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
              borderRadius: borderRadius.sm,
              borderWidth: 1,
            }),
            {
              color: theme.colors.text,
              borderColor,
              backgroundColor: theme.colors.surface,
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
  }
);
