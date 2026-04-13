/**
 * `Button` -- themed pressable button with variants and sizes.
 *
 * Supports `solid`, `outlined`, `ghost`, and `text` variants,
 * three sizes, loading/disabled states, and optional icon slots.
 *
 * @example
 * ```tsx
 * <Button title="Save" variant="solid" size="md" onPress={save} />
 * <Button title="Delete" variant="outlined" color="destructive" onPress={del} />
 * ```
 */

import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../text';

export type ButtonVariant = 'solid' | 'outlined' | 'ghost' | 'text';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  /** Button label. */
  title: string;
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
    borderRadius: 12,
  },
  md: {
    py: 2 as number,
    px: 4 as number,
    fontSize: 'base' as const,
    borderRadius: 16,
  },
  lg: {
    py: 3 as number,
    px: 6 as number,
    fontSize: 'lg' as const,
    borderRadius: 20,
  },
};

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
  const accent = theme.colors[color as keyof typeof theme.colors] ?? color;
  const isDisabled = disabled || loading;

  const bgColor =
    variant === 'solid'
      ? isDisabled
        ? theme.colors.disabled
        : accent
      : 'transparent';
  const borderColor =
    variant === 'outlined'
      ? isDisabled
        ? theme.colors.disabled
        : accent
      : 'transparent';
  const textColor =
    variant === 'solid'
      ? theme.colors.paper
      : isDisabled
        ? theme.colors.disabled
        : accent;

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
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {startIcon && <View>{startIcon}</View>}
          <Text
            variant="bodyBold"
            sx={{ fontSize: s.fontSize }}
            style={{ color: textColor }}
          >
            {title}
          </Text>
          {endIcon && <View>{endIcon}</View>}
        </>
      )}
    </Pressable>
  );
}
