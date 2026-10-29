import type { ColorPalette } from './colors-types';
import { readColor, readGroup } from './design-tokens';
import { color } from './design-tokens.json';

/**
 * Dark-first neutrals and one blue: a near-black canvas, raised and sunken
 * paper, two ink tiers, and blue for what to do or what is chosen. The values
 * are the `color.light` / `color.dark` groups of `design-tokens.json`.
 *
 * - `tintActive` (#2563eb) is the one saturated fill at rest: primary
 *   buttons and "Sit here", under a white label in both schemes.
 * - `tint` is blue as text (links); `primaryStrong` marks what is selected
 *   or yours; `tintSubtle` washes a selected chip or the active player.
 * - `player1`…`player8` are seat colors, spaced by lightness so they never
 *   rely on hue alone. `board*` are neutral board surfaces.
 * - Surfaces are flat neutrals: no gradients, no glows.
 *
 * Retune `pkgs/ui-root-shared-ts/src/design-tokens.json`, then
 * `bun run --filter @pkgs/ui-root-client-ts tokens:generate`.
 * `tests/palette-contrast.test.ts` holds every text/fill pair to WCAG AA.
 */
export const COLOR_PALETTE: ColorPalette = {
  light: readGroup({}, color.light, readColor),
  dark: readGroup({}, color.dark, readColor),
};
