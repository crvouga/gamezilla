/**
 * `IconButton` -- a circular button that renders a single child icon.
 *
 * @example
 * ```tsx
 * <IconButton size={40} onPress={handleClose}>
 *   <Text style={{ fontSize: 18 }}>✕</Text>
 * </IconButton>
 * ```
 */

import { type ReactNode } from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '../../theme';

export type IconButtonProps = {
  children: ReactNode;
  onPress?: () => void;
  /** Diameter in pixels. Defaults to 40. */
  size?: number;
  /** Color token or raw color for the background. */
  background?: string;
  disabled?: boolean;
};

export function IconButton({
  children,
  onPress,
  size = 40,
  background,
  disabled = false,
}: IconButtonProps) {
  const theme = useTheme();
  const bg = background
    ? (theme.colors[background as keyof typeof theme.colors] ?? background)
    : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
        },
        pressed && !disabled && { opacity: 0.7 },
        disabled && { opacity: 0.4 },
      ]}
    >
      {children}
    </Pressable>
  );
}
