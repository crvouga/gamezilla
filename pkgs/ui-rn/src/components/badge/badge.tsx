/**
 * `Badge` -- small status indicator or count label.
 * Nuclear overhaul: no pulse / ping Animated.loops.
 *
 * @example
 * ```tsx
 * <Badge label="New" intent="success" />
 * <Badge label="3" intent="brand" tone="solid" size="sm" />
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
   * When set, supersedes `intent` and renders solid.
   */
  color?: string;
  /** Size preset. Defaults to `"md"`. */
  size?: 'sm' | 'md';
  /** Ignored — nuclear overhaul removes pulse loops. */
  pulse?: boolean;
  /** Ignored — nuclear overhaul removes ping loops. */
  ping?: boolean;
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

const SM_MIN_SIZE = 18;

function resolveBadgeColors(args: {
  intent: BadgeIntent;
  tone: BadgeTone;
  color: string | undefined;
  themeColors: ColorTokens & Record<string, string>;
}): { bg: string; fg: string } {
  const tokens = INTENT_TO_TOKENS[args.intent][args.tone];
  if (args.color !== undefined) {
    const bg = args.themeColors[args.color] ?? args.color;
    return { bg, fg: bestOnColor(bg).fg };
  }
  return {
    bg: args.themeColors[tokens.bg],
    fg: args.themeColors[tokens.fg],
  };
}

export function Badge({
  label,
  intent = 'brand',
  tone = 'subtle',
  color,
  size = 'md',
  dataSet,
}: BadgeProps) {
  const theme = useTheme();
  const { bg, fg } = resolveBadgeColors({
    intent,
    tone,
    color,
    themeColors: theme.colors,
  });
  const isSmall = size === 'sm';
  const fontSize = isSmall ? 11 : 12;

  return (
    <Box
      dataSet={{ component: 'Badge', ...dataSet }}
      sx={{
        alignSelf: 'flex-start',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        borderRadius: 'full',
        paddingHorizontal: isSmall ? 6 : 8,
        paddingVertical: isSmall ? 2 : 3,
        ...(isSmall
          ? { minWidth: SM_MIN_SIZE, minHeight: SM_MIN_SIZE }
          : undefined),
      }}
    >
      <Text
        sx={{
          color: fg,
          fontSize,
          lineHeight: fontSize + 2,
          fontWeight: '700',
        }}
        label={label}
      />
    </Box>
  );
}
