/**
 * `Badge` -- small status indicator or count label.
 *
 * Pass `intent` to pick from the semantic palette (`neutral`, `success`,
 * `warning`, `destructive`, `info`, `brand`). Each intent uses the matching
 * subtle surface as the fill + the saturated semantic color for the text,
 * keeping legibility on both schemes.
 *
 * The legacy `color` prop is still accepted (raw color token or any CSS
 * color) and wins over `intent` when set so existing call sites keep
 * working.
 *
 * @example
 * ```tsx
 * <Badge label="New" intent="success" />
 * <Badge label="3" intent="destructive" />
 * ```
 */

import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme, type ColorTokens } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Text } from '../text';

export type BadgeIntent =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info';

export type BadgeProps = {
  /** Text displayed inside the badge. */
  label: ReactNode;
  /** Semantic intent. Defaults to `"brand"` (matches legacy `"tint"`). */
  intent?: BadgeIntent;
  /**
   * Optional raw color override (palette token name or any CSS color).
   * When set, supersedes `intent`. Foreground is auto-derived to white
   * since the caller is opting out of the semantic surface contract.
   */
  color?: string;
  /** Size preset. Defaults to `"md"`. */
  size?: 'sm' | 'md';
};

type IntentColors = { bg: keyof ColorTokens; fg: keyof ColorTokens };

const INTENT_TO_TOKENS: Record<BadgeIntent, IntentColors> = {
  neutral: { bg: 'surfaceMuted', fg: 'textSecondary' },
  brand: { bg: 'tintSubtle', fg: 'tint' },
  success: { bg: 'successSurface', fg: 'success' },
  warning: { bg: 'warningSurface', fg: 'warning' },
  destructive: { bg: 'destructiveSurface', fg: 'destructive' },
  info: { bg: 'infoSurface', fg: 'info' },
};

export function Badge({
  label,
  intent = 'brand',
  color,
  size = 'md',
}: BadgeProps) {
  const theme = useTheme();
  const tokens = INTENT_TO_TOKENS[intent];
  const bg =
    color !== undefined
      ? (theme.colors[color as keyof typeof theme.colors] ?? color)
      : theme.colors[tokens.bg];
  const fg =
    color !== undefined ? theme.colors.onTint : theme.colors[tokens.fg];

  const isSmall = size === 'sm';
  const px = isSmall ? 6 : 8;
  const py = isSmall ? 1 : 2;
  const fontSize = isSmall ? 11 : 12;

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: borderRadius.full,
        paddingHorizontal: px,
        paddingVertical: py,
      }}
    >
      <Text style={{ color: fg, fontSize, fontWeight: '600' }} label={label} />
    </View>
  );
}
