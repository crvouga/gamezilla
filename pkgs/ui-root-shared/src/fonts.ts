/**
 * UI faces. Nunito is self-hosted (`fonts.css` + `nunito-latin.woff2`) with
 * `font-display: swap`. The rest of the stack is the fallback while it loads.
 * Emitted as `--ui-font-*` in `tokens.css`.
 */

const NUNITO = 'Nunito, ui-sans-serif, system-ui, sans-serif';

export type FontStacks = {
  sans: string;
  serif: string;
  rounded: string;
  display: string;
  mono: string;
};

export const fonts: FontStacks = {
  sans: NUNITO,
  serif:
    'ui-serif, Georgia, "Iowan Old Style", "Palatino Linotype", Palatino, serif',
  rounded: NUNITO,
  display: NUNITO,
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
};
