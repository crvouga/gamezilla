/**
 * `AppLogo` -- in-house Gamezilla brand mark.
 *
 * Pure SVG (via `react-native-svg`) so it scales crisply at any size and
 * picks up the active theme's brand color. Three stacked rounded squares
 * form a controller-grid silhouette; the wordmark uses the rounded font
 * stack for a friendly, modern feel.
 *
 * @example
 * ```tsx
 * <AppLogo />                       // mark + wordmark, brand tinted
 * <AppLogo wordmark={false} />      // mark only (compact header)
 * <AppLogo size={48} />             // larger for splash / hero
 * ```
 */

import type { ReactNode } from 'react';

import type { ComponentDataSet } from '../../component-id';
import { type ColorTokens, useTheme } from '../../theme';
import { Box } from '../box';
import { Text } from '../text';

export type AppLogoProps = {
  /** Pixel size of the mark (the wordmark scales proportionally). Defaults to 28. */
  size?: number;
  /** When true, renders "gamezilla" next to the mark. Defaults to true. */
  wordmark?: boolean;
  /** Color token or raw color for the mark + wordmark. Defaults to `tint`. */
  color?: string;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

/** Width:height ratio used when rendering the wordmark text element. */
const WORDMARK_HEIGHT_RATIO = 0.7;

function resolveColor(color: string | undefined, colors: ColorTokens): string {
  if (color === undefined) return colors.tint;
  if (color in colors) return colors[color as keyof ColorTokens];
  return color;
}

export function AppLogo({
  size = 28,
  color,
  dataSet,
}: AppLogoProps): ReactNode {
  const theme = useTheme();
  const fill = resolveColor(color, theme.colors);
  const wordmarkFontSize = Math.round(size * WORDMARK_HEIGHT_RATIO);
  return (
    <Box
      dataSet={{ component: 'AppLogo', ...dataSet }}
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Math.max(1, Math.round(size * 0.25) / 4),
      }}
    >
      <Text
        accessibilityRole="header"
        aria-level={1}
        sx={{
          color: fill,
          fontFamily: theme.fonts.rounded,
          fontSize: wordmarkFontSize,
          fontWeight: '800',
          letterSpacing: -0.5,
          lineHeight: Math.round(wordmarkFontSize * 1.1),
        }}
        label="gamezilla"
      />
    </Box>
  );
}
