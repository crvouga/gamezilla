import type { ColorTokens } from './colors-types';
import designTokens from './design-tokens.json' with { type: 'json' };
import { readColor, readGroup } from './design-tokens.ts';

/**
 * Application colors and board-scoped game palettes, projected from
 * design-tokens.json. Retune that source, then run `bun tokens:generate`.
 * Palette contrast tests hold text/fill pairs to WCAG AA.
 */
export const COLOR_PALETTE: ColorTokens = readGroup(
  {},
  designTokens.color,
  readColor
);
