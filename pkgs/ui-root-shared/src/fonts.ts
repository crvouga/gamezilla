/**
 * Two faces, two jobs.
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

const SYSTEM =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export type FontStacks = {
  sans: string;
  display: string;
  mono: string;
};

export const fonts: FontStacks = {
  sans: SYSTEM,
  display: `"Bricolage Grotesque", ${SYSTEM}`,
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
};
