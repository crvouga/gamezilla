import type { ColorPalette } from './colors-types';

/**
 * Neutral surfaces and one blue, the proven look of the big social apps:
 * white and true black, gray text tiers, blue for what to do or what is
 * chosen.
 *
 * - `tintActive` is the blue fill of every primary action, with a white
 *   label (`onPrimary`) in both schemes. It sits a step deeper than the
 *   familiar sky blue so a white label keeps AA contrast.
 * - `tint` is blue as text, links, focus and selection: the sky blue on
 *   black, a deeper blue on white so small text stays readable.
 *   Solid fills use `tintActive`, never `tint`.
 * - Surfaces are pure neutrals: no tinted grays, no gradients.
 *
 * Retune here, then `bun run --filter @pkgs/ui-root-client tokens:generate`.
 * `tests/palette-contrast.test.ts` holds every text/fill pair to WCAG AA.
 */
export const COLOR_PALETTE: ColorPalette = {
  light: {
    background: 'hsla(0, 0%, 100%, 1)',
    surface: 'hsla(180, 14%, 97%, 1)',
    surfaceSunken: 'hsla(195, 15%, 94%, 1)',
    surfaceMuted: 'hsla(195, 15%, 94%, 1)',
    surfaceElevated: 'hsla(0, 0%, 100%, 1)',
    surfaceOverlay: 'hsla(0, 0%, 100%, 1)',

    text: 'hsla(210, 25%, 7%, 1)',
    textSecondary: 'hsla(206, 13%, 37%, 1)',
    icon: 'hsla(206, 13%, 37%, 1)',

    tint: 'hsla(204, 88%, 37%, 1)',
    tintHover: 'hsla(204, 88%, 31%, 1)',
    tintActive: 'hsla(204, 88%, 39%, 1)',
    tintSubtle: 'hsla(204, 88%, 53%, 0.10)',
    tintMuted: 'hsla(204, 88%, 53%, 0.24)',
    tintHighlight: 'hsla(204, 88%, 53%, 0.14)',
    onPrimary: 'hsla(0, 0%, 100%, 1)',
    onDestructive: 'hsla(0, 0%, 100%, 1)',
    onSuccess: 'hsla(0, 0%, 100%, 1)',
    onWarning: 'hsla(0, 0%, 100%, 1)',
    onInfo: 'hsla(0, 0%, 100%, 1)',
    onTintScrim: 'hsla(210, 25%, 7%, 0.32)',

    interactiveHover: 'hsla(210, 25%, 7%, 0.04)',
    interactivePress: 'hsla(210, 25%, 7%, 0.08)',

    border: 'hsla(200, 17%, 91%, 1)',
    outline: 'hsla(204, 16%, 82%, 1)',
    focusRing: 'hsla(204, 88%, 53%, 0.60)',

    tabIconDefault: 'hsla(206, 13%, 37%, 1)',
    tabIconSelected: 'hsla(210, 25%, 7%, 1)',

    destructive: 'hsla(356, 78%, 44%, 1)',
    destructiveActive: 'hsla(356, 78%, 44%, 1)',
    destructiveSurface: 'hsla(356, 91%, 54%, 0.10)',
    success: 'hsla(160, 100%, 23%, 1)',
    successSurface: 'hsla(160, 100%, 36%, 0.12)',
    warning: 'hsla(30, 100%, 30%, 1)',
    warningSurface: 'hsla(50, 100%, 50%, 0.18)',
    info: 'hsla(204, 88%, 37%, 1)',
    infoSurface: 'hsla(204, 88%, 53%, 0.10)',

    disabled: 'hsla(195, 15%, 92%, 1)',

    scrim: 'hsla(210, 25%, 7%, 0.40)',
    shadowColor: 'hsla(210, 25%, 7%, 0.12)',
  },
  dark: {
    background: 'hsla(0, 0%, 0%, 1)',
    surface: 'hsla(220, 12%, 10%, 1)',
    surfaceSunken: 'hsla(0, 0%, 0%, 1)',
    surfaceMuted: 'hsla(210, 10%, 14%, 1)',
    surfaceElevated: 'hsla(220, 12%, 10%, 1)',
    surfaceOverlay: 'hsla(210, 10%, 14%, 1)',

    text: 'hsla(200, 7%, 91%, 1)',
    textSecondary: 'hsla(210, 11%, 60%, 1)',
    icon: 'hsla(210, 11%, 71%, 1)',

    tint: 'hsla(204, 88%, 53%, 1)',
    tintHover: 'hsla(204, 88%, 62%, 1)',
    tintActive: 'hsla(204, 88%, 39%, 1)',
    tintSubtle: 'hsla(204, 88%, 53%, 0.14)',
    tintMuted: 'hsla(204, 88%, 53%, 0.28)',
    tintHighlight: 'hsla(204, 88%, 53%, 0.20)',
    onPrimary: 'hsla(0, 0%, 100%, 1)',
    onDestructive: 'hsla(0, 0%, 100%, 1)',
    onSuccess: 'hsla(0, 0%, 0%, 1)',
    onWarning: 'hsla(0, 0%, 0%, 1)',
    onInfo: 'hsla(0, 0%, 0%, 1)',
    onTintScrim: 'hsla(0, 0%, 0%, 0.40)',

    interactiveHover: 'hsla(200, 7%, 91%, 0.06)',
    interactivePress: 'hsla(200, 7%, 91%, 0.12)',

    border: 'hsla(210, 7%, 18%, 1)',
    outline: 'hsla(210, 8%, 28%, 1)',
    focusRing: 'hsla(204, 88%, 53%, 0.70)',

    tabIconDefault: 'hsla(210, 11%, 60%, 1)',
    tabIconSelected: 'hsla(200, 7%, 91%, 1)',

    destructive: 'hsla(356, 91%, 66%, 1)',
    destructiveActive: 'hsla(356, 78%, 46%, 1)',
    destructiveSurface: 'hsla(356, 91%, 54%, 0.16)',
    success: 'hsla(160, 100%, 36%, 1)',
    successSurface: 'hsla(160, 100%, 36%, 0.16)',
    warning: 'hsla(50, 100%, 50%, 1)',
    warningSurface: 'hsla(50, 100%, 50%, 0.16)',
    info: 'hsla(204, 88%, 53%, 1)',
    infoSurface: 'hsla(204, 88%, 53%, 0.14)',

    disabled: 'hsla(210, 10%, 16%, 1)',

    scrim: 'hsla(0, 0%, 0%, 0.72)',
    shadowColor: 'hsla(0, 0%, 0%, 0.50)',
  },
};
