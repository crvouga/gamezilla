/**
 * `TextInput` -- styled text input with label, error, and helper text.
 *
 * Focus animates the border to the active `tint` and adds a 2px `focusRing`
 * outline on web for accessibility polish. Error state swaps the border to
 * `destructive` and tints the surface with the matching subtle surface so
 * the field still reads as a coherent input rather than a stripped one.
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

import type { LocalizedString } from '@pkgs/i18n';
import { forwardRef, useState, type ReactNode } from 'react';
import {
  Platform,
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

function resolveBorderColor(args: {
  hasError: boolean;
  focused: boolean;
  destructive: string;
  tint: string;
  outline: string;
}): string {
  if (args.hasError) return args.destructive;
  if (args.focused) return args.tint;
  return args.outline;
}

export const TextInput = forwardRef<RNTextInput, TextInputProps>(
  function TextInput(
    { label, error, helperText, sx: sxProp, onFocus, onBlur, ...rest },
    ref
  ) {
    const theme = useTheme();
    const [focused, setFocused] = useState(false);
    const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
    const hasError = error !== undefined;
    const borderColor = resolveBorderColor({
      hasError,
      focused,
      destructive: theme.colors.destructive,
      tint: theme.colors.tint,
      outline: theme.colors.outline,
    });

    const handleFocus: NonNullable<RNTextInputProps['onFocus']> = (e) => {
      setFocused(true);
      onFocus?.(e);
    };
    const handleBlur: NonNullable<RNTextInputProps['onBlur']> = (e) => {
      setFocused(false);
      onBlur?.(e);
    };

    const surfaceBg = hasError
      ? theme.colors.destructiveSurface
      : theme.colors.surfaceMuted;
    const focusRingStyle =
      focused && Platform.OS === 'web'
        ? {
            outlineStyle: 'solid' as const,
            outlineWidth: 2,
            outlineColor: hasError
              ? theme.colors.destructive
              : theme.colors.focusRing,
            outlineOffset: 2,
          }
        : undefined;

    return (
      <View style={[{ gap: 4 }, sxStyle]}>
        {label && <Text variant="label" label={label} />}
        <RNTextInput
          ref={ref}
          placeholderTextColor={theme.colors.textSecondary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[
            theme.sx({
              py: 3,
              px: 4,
              fontSize: 'base',
              borderRadius: borderRadius.md,
              borderWidth: 1,
            }),
            {
              color: theme.colors.text,
              borderColor,
              backgroundColor: surfaceBg,
            },
            focusRingStyle,
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
