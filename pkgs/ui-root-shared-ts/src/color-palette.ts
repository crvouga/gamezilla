import type { ColorPalette } from './colors-types';
import { readColor, readGroup } from './design-tokens';
import { color } from './design-tokens.json';

/**
 * Achromatic application colors and board-scoped game palettes, projected from
 * design-tokens.json. Retune that source, then run `bun tokens:generate`.
 * Palette contrast tests hold text/fill pairs to WCAG AA.
 */
export const COLOR_PALETTE: ColorPalette = {
  light: readGroup({}, color.light, readColor),
  dark: readGroup({}, color.dark, readColor),
};
