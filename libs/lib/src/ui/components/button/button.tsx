/**
 * `Button` -- themed pressable button with variants and sizes.
 *
 * Supports `solid`, `outlined`, `ghost`, and `text` variants,
 * three sizes, loading/disabled states, and optional icon slots.
 *
 * Vendor-branded buttons (e.g. "Sign in with Google", "Sign in with Apple")
 * have their own component because their colors, padding, label, and logo
 * are dictated by external branding guidelines and cannot be expressed via
 * this generic API.
 *
 * @example
 * ```tsx
 * <Button title="Save" variant="solid" size="md" onPress={save} />
 * <Button title="Delete" variant="outlined" color="destructive" onPress={del} />
 * ```
 */

import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Spinner } from '../spinner';
import { Text } from '../text';

export type ButtonVariant = 'solid' | 'outlined' | 'ghost' | 'text';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  /** Button label. */
  title: ReactNode;
  onPress?: () => void;
  /** Visual variant. Defaults to `"solid"`. */
  variant?: ButtonVariant;
  /** Size preset. Defaults to `"md"`. */
  size?: ButtonSize;
  /** Color token name for the button accent. Defaults to `"tint"`. */
  color?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Rendered before the label. */
  startIcon?: ReactNode;
  /** Rendered after the label. */
  endIcon?: ReactNode;
};

const sizeMap = {
  sm: {
    py: 1 as number,
    px: 3 as number,
    fontSize: 'sm' as const,
    borderRadius: borderRadius.md,
  },
  md: {
    py: 2 as number,
    px: 4 as number,
    fontSize: 'base' as const,
    borderRadius: borderRadius.lg,
  },
  lg: {
    py: 3 as number,
    px: 6 as number,
    fontSize: 'lg' as const,
    borderRadius: borderRadius.full,
  },
};

type ButtonColors = {
  bgColor: string;
  borderColor: string;
  textColor: string;
};

function resolveButtonColors(
  theme: ReturnType<typeof useTheme>,
  variant: ButtonVariant,
  color: string,
  isDisabled: boolean
): ButtonColors {
  const accent = theme.colors[color as keyof typeof theme.colors] ?? color;
  const accentOrDisabled = isDisabled ? theme.colors.disabled : accent;
  const bgColor = variant === 'solid' ? accentOrDisabled : 'transparent';
  const borderColor = variant === 'outlined' ? accentOrDisabled : 'transparent';
  const textColor =
    variant === 'solid' ? theme.colors.surface : accentOrDisabled;
  return { bgColor, borderColor, textColor };
}

export function Button({
  title,
  onPress,
  variant = 'solid',
  size = 'md',
  color = 'tint',
  disabled = false,
  loading = false,
  startIcon,
  endIcon,
}: ButtonProps) {
  const theme = useTheme();
  const s = sizeMap[size];
  const isDisabled = disabled || loading;
  const { bgColor, borderColor, textColor } = resolveButtonColors(
    theme,
    variant,
    color,
    isDisabled
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        theme.sx({
          py: s.py,
          px: s.px,
          borderRadius: s.borderRadius,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          userSelect: 'none',
        }),
        { backgroundColor: bgColor },
        variant === 'outlined' && { borderWidth: 1, borderColor },
        pressed && !isDisabled && { opacity: 0.7 },
      ]}
    >
      <ButtonContent
        title={title}
        loading={loading}
        textColor={textColor}
        fontSize={s.fontSize}
        startIcon={startIcon}
        endIcon={endIcon}
      />
    </Pressable>
  );
}

function ButtonContent({
  title,
  loading,
  textColor,
  fontSize,
  startIcon,
  endIcon,
}: {
  title: ReactNode;
  loading: boolean;
  textColor: string;
  fontSize: 'sm' | 'base' | 'lg';
  startIcon: ReactNode;
  endIcon: ReactNode;
}) {
  if (loading) return <Spinner size="small" color={textColor} />;
  return (
    <>
      {startIcon !== undefined ? <View>{startIcon}</View> : null}
      <Text
        variant="bodyBold"
        sx={{ fontSize }}
        style={{ color: textColor }}
        label={title}
      />
      {endIcon !== undefined ? <View>{endIcon}</View> : null}
    </>
  );
}
