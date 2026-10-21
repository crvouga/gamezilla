/**
 * One face. The stacks are read from `design-tokens.json`.
 *
 * - `sans` is the platform system face (SF on Apple, Roboto on Android,
 *   Segoe on Windows): every title, label, button and line of body copy.
 *   Zero bytes, and the best-hinted text at small sizes on a low-end phone.
 * - `mono` is for code and identifiers only, never for numbers or labels.
 *
 * Emitted as `--ui-font-*` in `tokens.css`.
 */

import { readFontStack, readGroup } from './design-tokens';
import { font } from './design-tokens.json';

export type FontStacks = {
  sans: string;
  mono: string;
};

export const fonts: FontStacks = readGroup({}, font.family, readFontStack);
