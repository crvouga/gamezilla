/**
 * One face. The stacks are read from `design-tokens.json`.
 *
 * - `sans` is Manrope (400, 500, 700): every label, button, title and line
 *   of body copy, falling back to the platform system face while it loads.
 * - `display` is the same face for numbers (ratings, scores, clocks, counts),
 *   set with tabular figures by the `stat` and `numeral` roles.
 * - `mono` is for code and identifiers only, never for numbers or labels.
 *
 * Emitted as `--ui-font-*` in `tokens.css`.
 */

import { readFontStack, readGroup } from './design-tokens';
import { font } from './design-tokens.json';

export type FontStacks = {
  sans: string;
  display: string;
  mono: string;
};

export const fonts: FontStacks = readGroup({}, font.family, readFontStack);
