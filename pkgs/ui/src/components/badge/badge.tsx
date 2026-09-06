/** @jsxImportSource solid-js */
/**
 * `Badge` -- small status indicator or count label.
 *
 * @example
 * ```tsx
 * <Badge label="New" intent="success" />
 * <Badge label="3" intent="brand" tone="solid" size="sm" />
 * ```
 */

import { createMemo, type JSX } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import {
  bestOnColor,
  type ColorTokenName,
  resolveColor,
  useThemeTokens,
} from '../../theme';
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

export type BadgeSize = 'sm' | 'md';

export type BadgeProps = {
  /** Text displayed inside the badge. */
  label: JSX.Element;
  /** Semantic intent. Defaults to `"brand"`. */
  intent?: BadgeIntent | undefined;
  /** Visual weight. Defaults to `"subtle"`. */
  tone?: BadgeTone | undefined;
  /**
   * Optional raw color override (palette token name or any CSS color).
   * When set, supersedes `intent` and renders solid with an auto-contrast
   * label.
   */
  color?: string | undefined;
  /** Size preset. Defaults to `"md"`. */
  size?: BadgeSize | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

type IntentTokens = {
  subtle: { bg: ColorTokenName; fg: ColorTokenName };
  solid: { bg: ColorTokenName; fg: ColorTokenName };
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

export function Badge(props: BadgeProps): JSX.Element {
  const tokens = useThemeTokens();
  const colors = createMemo((): { bg: string; fg: string } => {
    if (props.color !== undefined) {
      const raw = resolveColor(props.color, tokens.palette()) ?? props.color;
      return { bg: props.color, fg: bestOnColor(raw).fg };
    }
    const t = INTENT_TO_TOKENS[props.intent ?? 'brand'][props.tone ?? 'subtle'];
    return { bg: t.bg, fg: t.fg };
  });
  const isSmall = () => (props.size ?? 'md') === 'sm';
  const fontSize = () => (isSmall() ? 11 : 12);

  return (
    <Box
      as="span"
      dataSet={{ component: 'Badge', ...props.dataSet }}
      sx={{
        display: 'inline-flex',
        alignSelf: 'flex-start',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors().bg,
        borderRadius: 'full',
        paddingHorizontal: isSmall() ? 6 : 8,
        paddingVertical: isSmall() ? 2 : 3,
        ...(isSmall()
          ? { minWidth: SM_MIN_SIZE, minHeight: SM_MIN_SIZE }
          : undefined),
      }}
    >
      <Text
        sx={{
          color: colors().fg,
          fontSize: fontSize(),
          lineHeight: fontSize() + 2,
          fontWeight: '700',
        }}
        label={props.label}
      />
    </Box>
  );
}
