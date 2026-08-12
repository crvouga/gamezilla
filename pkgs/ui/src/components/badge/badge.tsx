/**
 * `Badge` -- small status indicator or count label.
 *
 * `intent` picks the semantic palette (`neutral`, `success`, `warning`,
 * `destructive`, `info`, `brand`). `tone` controls how loud the badge
 * reads:
 *   - `'subtle'` (default) -- soft surface fill + saturated foreground,
 *     for inline labels and metadata.
 *   - `'solid'` -- saturated background + `on*` foreground, for counts
 *     and high-priority indicators (GitHub / Linear notification badges).
 *
 * The legacy `color` prop is still accepted (raw color token or any CSS
 * color) and wins over `intent` when set so existing call sites keep
 * working; it always renders as a solid swatch.
 *
 * @example
 * ```tsx
 * <Badge label="New" intent="success" />
 * <Badge label="3" intent="destructive" tone="solid" />
 * ```
 */

import type { ReactNode } from 'react';
import type { ComponentDataSet } from '../../component-id';
import { bestOnColor, type ColorTokens, useTheme } from '../../theme';
import { Box } from '../box';
import { Text } from '../text';

export type BadgeIntent =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info';

export type BadgeTone = 'subtle' | 'solid';

export type BadgeProps = {
  /** Text displayed inside the badge. */
  label: ReactNode;
  /** Semantic intent. Defaults to `"brand"`. */
  intent?: BadgeIntent;
  /** Visual weight. Defaults to `"subtle"`. */
  tone?: BadgeTone;
  /**
   * Optional raw color override (palette token name or any CSS color).
   * When set, supersedes `intent` and renders solid. Foreground is auto-
   * derived from the fill's luminance for a contrast-safe label.
   */
  color?: string;
  /** Size preset. Defaults to `"md"`. */
  size?: 'sm' | 'md';
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

type IntentTokens = {
  subtle: { bg: keyof ColorTokens; fg: keyof ColorTokens };
  solid: { bg: keyof ColorTokens; fg: keyof ColorTokens };
};

const INTENT_TO_TOKENS: Record<BadgeIntent, IntentTokens> = {
  neutral: {
    subtle: { bg: 'surfaceMuted', fg: 'textSecondary' },
    solid: { bg: 'text', fg: 'background' },
  },
  brand: {
    subtle: { bg: 'tintSubtle', fg: 'tint' },
    solid: { bg: 'tintActive', fg: 'onPrimary' },
  },
  success: {
    subtle: { bg: 'successSurface', fg: 'success' },
    solid: { bg: 'success', fg: 'onSuccess' },
  },
  warning: {
    subtle: { bg: 'warningSurface', fg: 'warning' },
    solid: { bg: 'warning', fg: 'onWarning' },
  },
  destructive: {
    subtle: { bg: 'destructiveSurface', fg: 'destructive' },
    solid: { bg: 'destructiveActive', fg: 'onDestructive' },
  },
  info: {
    subtle: { bg: 'infoSurface', fg: 'info' },
    solid: { bg: 'info', fg: 'onInfo' },
  },
};

export function Badge({
  label,
  intent = 'brand',
  tone = 'subtle',
  color,
  size = 'md',
  dataSet,
}: BadgeProps) {
  const theme = useTheme();
  const tokens = INTENT_TO_TOKENS[intent][tone];
  const bg =
    color !== undefined
      ? (theme.colors[color as keyof typeof theme.colors] ?? color)
      : theme.colors[tokens.bg];
  const fg = color !== undefined ? bestOnColor(bg).fg : theme.colors[tokens.fg];

  const isSmall = size === 'sm';
  return (
    <Box
      dataSet={{ component: 'Badge', ...dataSet }}
      sx={{
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: 'full',
        paddingHorizontal: isSmall ? 6 : 8,
        paddingVertical: isSmall ? 1 : 2,
      }}
    >
      <Text
        sx={{ color: fg, fontSize: isSmall ? 11 : 12, fontWeight: '600' }}
        label={label}
      />
    </Box>
  );
}
