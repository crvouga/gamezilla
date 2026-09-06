/**
 * `TextInput` -- styled text input with label, error, and helper text.
 *
 * Flat surface field with a real focus ring on every platform: web uses
 * the `outline*` CSS properties, native renders a 2px ring as an extra
 * border layer so the focused state reads the same in light and dark.
 */

import type { LocalizedString } from '@pkgs/i18n';
import { forwardRef, type ReactNode, useState } from 'react';
import {
  Platform,
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
} from 'react-native';
import type { ComponentDataSet } from '../../component-id';
import type { SxInput, SxProps, Theme } from '../../theme';
import { useHostSx, useTheme } from '../../theme';
import { Box } from '../box';
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
  /**
   * Leading glyph inside the field (e.g. a search icon). Rendered
   * non-interactive; the text inset grows to make room.
   */
  startAdornment?: ReactNode;
  /** Utility-first style shorthand for the outer wrapper. */
  sx?: SxInput;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
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

/** Horizontal inset of the field text (`px: 4`). */
const FIELD_PX_STEP = 4;
/** Width reserved for a leading adornment (glyph + gap). */
const ADORNMENT_WIDTH_STEP = 7;

function fieldSx(args: {
  theme: Theme;
  hasError: boolean;
  focused: boolean;
  borderColor: string;
  hasStartAdornment: boolean;
}): SxProps {
  const { theme, hasError, focused, borderColor, hasStartAdornment } = args;
  const webRing =
    focused && Platform.OS === 'web'
      ? {
          outlineStyle: 'solid' as const,
          outlineWidth: 2,
          outlineColor: hasError
            ? theme.colors.destructive
            : theme.colors.focusRing,
          outlineOffset: 2,
        }
      : {};
  const nativeRing =
    focused && Platform.OS !== 'web' ? { borderWidth: 2, margin: -1 } : {};
  return {
    py: 2.5,
    px: FIELD_PX_STEP,
    ...(hasStartAdornment ? { pl: FIELD_PX_STEP + ADORNMENT_WIDTH_STEP } : {}),
    fontSize: 'base',
    borderRadius: 'md',
    borderWidth: 1,
    color: theme.colors.text,
    borderColor,
    backgroundColor: hasError
      ? theme.colors.destructiveSurface
      : theme.colors.surface,
    ...webRing,
    ...nativeRing,
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
    {
      label,
      error,
      helperText,
      startAdornment,
      sx: sxProp,
      dataSet,
      onFocus,
      onBlur,
      ...rest
    },
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
    const hasStartAdornment =
      startAdornment !== undefined && startAdornment !== null;
    const field = useHostSx(
      'TextInputField',
      fieldSx({ theme, hasError, focused, borderColor, hasStartAdornment })
    );

    return (
      <Box
        sx={[{ gap: 1 }, sxProp]}
        dataSet={{ component: 'TextInput', ...dataSet }}
      >
        {label ? <Text variant="label" label={label} /> : null}
        <Box sx={{ position: 'relative' }}>
          <RNTextInput
            ref={ref}
            placeholderTextColor={theme.colors.textSecondary}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={field.style}
            {...rest}
            {...field.dataSet}
          />
          {hasStartAdornment ? (
            <Box
              pointerEvents="none"
              sx={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                pl: FIELD_PX_STEP,
                justifyContent: 'center',
              }}
            >
              {startAdornment}
            </Box>
          ) : null}
        </Box>
        <FieldFooter error={error} helperText={helperText} />
      </Box>
    );
  }
);
