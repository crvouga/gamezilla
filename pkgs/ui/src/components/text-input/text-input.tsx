/**
 * `TextInput` -- styled text input with label, error, and helper text.
 *
 * Flat surface field with a real focus ring on every platform: web uses
 * the `outline*` CSS properties, native renders a 2px ring as an extra
 * border layer so the focused state reads the same in light and dark.
 *
 * Error state swaps the border to `destructive` and tints the surface
 * with the matching subtle surface so the field still reads as a
 * coherent input rather than a stripped one.
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
import type { SxProps, Theme } from '../../theme';
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

function resolveSurfaceBg(theme: Theme, hasError: boolean): string {
  return hasError ? theme.colors.destructiveSurface : theme.colors.surface;
}

function resolveFocusRingColor(theme: Theme, hasError: boolean): string {
  return hasError ? theme.colors.destructive : theme.colors.focusRing;
}

function resolveWebFocusRingStyle(
  theme: Theme,
  hasError: boolean,
  focused: boolean
) {
  if (!focused || Platform.OS !== 'web') return undefined;
  return {
    outlineStyle: 'solid' as const,
    outlineWidth: 2,
    outlineColor: resolveFocusRingColor(theme, hasError),
    outlineOffset: 2,
  };
}

function resolveNativeFocusRingStyle(focused: boolean) {
  if (!focused || Platform.OS === 'web') return undefined;
  return {
    borderWidth: 2,
    // Compensate so the padded content keeps its position when the
    // border width grows by 1px on focus.
    margin: -1,
  };
}

function FieldFooter({
  error,
  helperText,
}: {
  error: LocalizedString | undefined;
  helperText: LocalizedString | undefined;
}) {
  if (error) {
    return (
      <Text variant="caption" sx={{ color: 'destructive' }} label={error} />
    );
  }
  if (helperText) {
    return <Text variant="caption" label={helperText} />;
  }
  return null;
}

export const TextInput = forwardRef<RNTextInput, TextInputProps>(
  function TextInput(
    { label, error, helperText, sx: sxProp, onFocus, onBlur, ...rest },
    ref
  ) {
    const theme = useTheme();
    const [focused, setFocused] = useState(false);
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

    return (
      <View style={[{ gap: 4 }, sxProp ? theme.sx(sxProp) : undefined]}>
        {label && <Text variant="label" label={label} />}
        <RNTextInput
          ref={ref}
          placeholderTextColor={theme.colors.textSecondary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[
            theme.sx({
              py: 2.5,
              px: 4,
              fontSize: 'base',
              borderRadius: borderRadius.md,
              borderWidth: 1,
            }),
            {
              color: theme.colors.text,
              borderColor,
              backgroundColor: resolveSurfaceBg(theme, hasError),
            },
            resolveWebFocusRingStyle(theme, hasError, focused),
            resolveNativeFocusRingStyle(focused),
          ]}
          {...rest}
        />
        <FieldFooter error={error} helperText={helperText} />
      </View>
    );
  }
);
