/**
 * Derive a flat solid button surface from one source CSS color.
 * Nuclear overhaul: no bevel shadows, no gradient pair — one fill color.
 */

import { formatCssHsla, parseCssColor } from '../../theme/colors/css-color';

export type SolidButtonSurfaceKind = 'accent' | 'neutral';

export type SolidButtonSurface = {
  /** Always empty — no multi-layer box-shadow. */
  boxShadow: string;
  /** Flat fill. */
  backgroundColor: string;
};

/**
 * Build a flat surface from a CSS source color.
 * Unparseable input yields the raw string as fill.
 */
export function deriveSolidButtonSurface(
  sourceCss: string,
  _kind: SolidButtonSurfaceKind
): SolidButtonSurface {
  const source = parseCssColor(sourceCss);
  const fill = source ? formatCssHsla(source) : sourceCss;
  return {
    boxShadow: '',
    backgroundColor: fill,
  };
}
