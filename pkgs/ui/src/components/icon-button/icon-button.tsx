/**
 * `IconButton` -- a circular button that renders a single child icon.
 *
 * Uses the themed {@link Pressable} so hover (web) and press feedback come
 * from the `interactiveHover` / `interactivePress` overlay tokens.
 * Disabled swaps the foreground (via the icon's own consumer) without
 * relying on flat opacity to dim the entire press target.
 *
 * @example
 * ```tsx
 * <IconButton size={40} onPress={handleClose}>
 *   <XIcon size={18} />
 * </IconButton>
 * ```
 */

import type { LocalizedString } from '@pkgs/i18n';
import { type ReactNode } from 'react';
import type { PressableProps as RNPressableProps } from 'react-native';
import { OnColorProvider, useTheme } from '../../theme';
import { Pressable } from '../pressable';

export type IconButtonProps = {
  children: ReactNode;
  onPress?: () => void;
  /** Diameter in pixels. Defaults to 40. */
  size?: number;
  /** Color token or raw color for the background. */
  background?: string;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: LocalizedString;
  accessibilityRole?: RNPressableProps['accessibilityRole'];
};

export function IconButton({
  children,
  onPress,
  size = 40,
  background,
  disabled = false,
  testID,
  accessibilityLabel,
  accessibilityRole = 'button',
}: IconButtonProps) {
  const theme = useTheme();
  const hasBackground = background !== undefined;
  const bg = hasBackground
    ? (theme.colors[background as keyof typeof theme.colors] ?? background)
    : 'transparent';
  const radius = size / 2;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      sx={{ borderRadius: radius }}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: bg,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {hasBackground ? (
        <OnColorProvider background={bg}>{children}</OnColorProvider>
      ) : (
        children
      )}
    </Pressable>
  );
}
