/** Framework-free sheen math for `MainMenuScreen` card rows. */

import { adjustLightness } from '@pkgs/colors-shared/ops';
import { formatCssHsla, parseCssColor } from './css-color';

/** Lightness delta for the neutral top→bottom sheen (very subtle). */
export const MENU_ITEM_GRADIENT_DELTA = 0.015;

export type NeutralGradient = { top: string; bottom: string };

/**
 * Very subtle top→bottom sheen derived from a raw surface color. Unparseable
 * inputs (e.g. `var(--…)` references) fall back to a flat fill.
 */
export function resolveNeutralGradient(surfaceCss: string): NeutralGradient {
  const source = parseCssColor(surfaceCss);
  if (source === null) return { top: surfaceCss, bottom: surfaceCss };
  return {
    top: formatCssHsla(adjustLightness(source, MENU_ITEM_GRADIENT_DELTA)),
    bottom: formatCssHsla(adjustLightness(source, -MENU_ITEM_GRADIENT_DELTA)),
  };
}
