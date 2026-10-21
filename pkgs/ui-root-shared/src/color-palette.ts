import type { ColorPalette } from './colors-types';
import { readGroup, readHsla } from './design-tokens';
import { color } from './design-tokens.json';

/**
 * Neutral surfaces and one blue, the proven look of the big social apps:
 * white and true black, gray text tiers, blue for what to do or what is
 * chosen. The values are the `color.light` / `color.dark` groups of
 * `design-tokens.json`.
 *
 * - `tintActive` is the blue fill of every primary action, with a white
 *   label (`onPrimary`) in both schemes. It sits a step deeper than the
 *   familiar sky blue so a white label keeps AA contrast.
 * - `tint` is blue as text, links, focus and selection: the sky blue on
 *   black, a deeper blue on white so small text stays readable.
 *   Solid fills use `tintActive`, never `tint`.
 * - Surfaces are pure neutrals: no tinted grays, no gradients.
 *
 * Retune `pkgs/ui-root-shared/src/design-tokens.json`, then
 * `bun run --filter @pkgs/ui-root-client tokens:generate`.
 * `tests/palette-contrast.test.ts` holds every text/fill pair to WCAG AA.
 */
export const COLOR_PALETTE: ColorPalette = {
  light: readGroup({}, color.light, readHsla),
  dark: readGroup({}, color.dark, readHsla),
};
