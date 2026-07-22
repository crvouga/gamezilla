/**
 * Derive a chess.com-style solid button surface from one source CSS color.
 *
 * Color stops come from `@pkgs/colors` ops; box-shadow geometry stays here
 * (CSS / paint concern).
 */

import { adjustLightness, setAlpha, type Rgba } from '@pkgs/colors';

import { formatCssHsla, parseCssColor } from '../../theme/colors/css-color';

export type SolidButtonSurfaceKind = 'accent' | 'neutral';

export type SolidButtonSurface = {
  gradientTop: string;
  gradientBottom: string;
  /** Chess bevel + soft outer drops. */
  boxShadow: string;
  /** Flat fallback fill (top stop). */
  backgroundColor: string;
};

const OUTER_DROPS =
  '0 0.1rem 0.2rem 0 rgba(0, 0, 0, 0.14), 0 0.2rem 0.4rem 0 rgba(0, 0, 0, 0.1)';

function accentShadow(highlight: Rgba, shade: Rgba): string {
  const topEdge = formatCssHsla(setAlpha(highlight, 0.4));
  const softTop = formatCssHsla(setAlpha(highlight, 0.5));
  const bottomEdge = formatCssHsla(shade);
  const softBottom = formatCssHsla(setAlpha(shade, 0.5));
  return [
    `inset 0 0.1rem 0 0 ${topEdge}`,
    `inset 0 -0.1rem 0 0 ${bottomEdge}`,
    `inset 0 0.2rem 0.4rem 0 ${softTop}`,
    `inset 0 -0.2rem 0.4rem 0 ${softBottom}`,
    OUTER_DROPS,
  ].join(', ');
}

function neutralShadow(highlight: Rgba): string {
  const topEdge = formatCssHsla(setAlpha(highlight, 0.35));
  return [`inset 0 0.1rem 0 0 ${topEdge}`, OUTER_DROPS].join(', ');
}

function deriveAccent(source: Rgba): SolidButtonSurface {
  const top = source;
  const bottom = adjustLightness(source, -0.1);
  const highlight = adjustLightness(source, 0.18);
  const shade = adjustLightness(source, -0.18);
  const gradientTop = formatCssHsla(top);
  return {
    gradientTop,
    gradientBottom: formatCssHsla(bottom),
    boxShadow: accentShadow(highlight, shade),
    backgroundColor: gradientTop,
  };
}

function deriveNeutral(source: Rgba): SolidButtonSurface {
  const top = adjustLightness(source, 0.04);
  const bottom = adjustLightness(source, -0.04);
  const highlight = adjustLightness(source, 0.12);
  const gradientTop = formatCssHsla(top);
  return {
    gradientTop,
    gradientBottom: formatCssHsla(bottom),
    boxShadow: neutralShadow(highlight),
    backgroundColor: gradientTop,
  };
}

/**
 * Build gradient stops + bevel shadow from a CSS source color.
 * Unparseable input yields a flat surface with no usable gradient pair.
 */
export function deriveSolidButtonSurface(
  sourceCss: string,
  kind: SolidButtonSurfaceKind
): SolidButtonSurface {
  const source = parseCssColor(sourceCss);
  if (!source) {
    return {
      gradientTop: sourceCss,
      gradientBottom: sourceCss,
      boxShadow: OUTER_DROPS,
      backgroundColor: sourceCss,
    };
  }
  return kind === 'accent' ? deriveAccent(source) : deriveNeutral(source);
}
