/**
 * Two faces, two jobs. The stacks are read from `design-tokens.json`.
 *
 * - `display` is Bricolage Grotesque: titles, headings, row titles, buttons,
 *   numerals (ratings, clocks, prices), and the brand. Self-hosted
 *   (`fonts.css` + `bricolage-latin.woff2`, weights 500–800, OFL) with
 *   `font-display: swap`.
 * - `sans` is the platform face (Roboto on Android, SF on Apple): body copy,
 *   captions, inputs. Zero bytes, and the best-hinted text at small sizes on
 *   a low-end phone.
 *
 * `mono` is for code and identifiers only, never for numbers or labels.
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
