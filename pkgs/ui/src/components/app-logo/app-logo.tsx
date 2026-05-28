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
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { useTheme, type ColorTokens } from '../../theme';
import { Text } from '../text';

export type AppLogoProps = {
  /** Pixel size of the mark (the wordmark scales proportionally). Defaults to 28. */
  size?: number;
  /** When true, renders "gamezilla" next to the mark. Defaults to true. */
  wordmark?: boolean;
  /** Color token or raw color for the mark + wordmark. Defaults to `tint`. */
  color?: string;
};

const MARK_VIEW_BOX = 24;
/** Width:height ratio used when rendering the wordmark text element. */
const WORDMARK_HEIGHT_RATIO = 0.7;

function resolveColor(color: string | undefined, colors: ColorTokens): string {
  if (color === undefined) return colors.tint;
  if (color in colors) return colors[color as keyof ColorTokens];
  return color;
}

function AppLogoMark({
  size,
  fill,
}: {
  size: number;
  fill: string;
}): ReactNode {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${MARK_VIEW_BOX} ${MARK_VIEW_BOX}`}
    >
      {/* Top tile -- a confident, slightly larger square that anchors the mark. */}
      <Rect x={4} y={2} width={16} height={8} rx={2.5} ry={2.5} fill={fill} />
      {/* Middle tile -- offset right, creates the controller-grid rhythm. */}
      <Rect x={9} y={11} width={11} height={5} rx={1.5} ry={1.5} fill={fill} />
      {/* Bottom tile -- mirror of the top with a touch of breathing room. */}
      <Rect x={4} y={17} width={16} height={5} rx={1.5} ry={1.5} fill={fill} />
    </Svg>
  );
}

export function AppLogo({
  size = 28,
  wordmark = true,
  color,
}: AppLogoProps): ReactNode {
  const theme = useTheme();
  const fill = resolveColor(color, theme.colors);
  const wordmarkFontSize = Math.round(size * WORDMARK_HEIGHT_RATIO);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Math.max(4, Math.round(size * 0.25)),
      }}
    >
      <AppLogoMark size={size} fill={fill} />
      {wordmark ? (
        <Text
          accessibilityRole="header"
          aria-level={1}
          style={{
            color: fill,
            fontFamily: theme.fonts.rounded,
            fontSize: wordmarkFontSize,
            fontWeight: '800',
            letterSpacing: -0.5,
            lineHeight: Math.round(wordmarkFontSize * 1.1),
            includeFontPadding: false,
          }}
          label="gamezilla"
        />
      ) : null}
    </View>
  );
}
