import type { ColorPalette } from './colors-types';

/**
 * Club room. A chess club's back room on game night: green baize, brass
 * clock plungers, ivory pieces. Dark is the baize table; light is the chalk
 * scoresheet.
 *
 * - Brass is the one accent. `tintActive` is the brass fill of every primary
 *   action in both schemes, and its label is always ink (`onPrimary`).
 * - `tint` is brass as text, links, focus, and selection. On baize it is the
 *   fill itself; on chalk brass is too pale to read, so it deepens to bronze.
 *   Never put `onPrimary` on `tint`: solid fills use `tintActive`.
 * - Surfaces are green, never neutral gray, so the canvas reads as felt.
 * - Warning is orange, not yellow, so it never reads as the accent.
 *
 * Retune here, then `bun run --filter @pkgs/ui-root-client tokens:generate`.
 * `tests/palette-contrast.test.ts` holds every text/fill pair to WCAG AA.
 */
export const COLOR_PALETTE: ColorPalette = {
  light: {
    background: 'hsla(100, 14%, 95%, 1)',
    surface: 'hsla(0, 0%, 100%, 1)',
    surfaceSunken: 'hsla(100, 12%, 91%, 1)',
    surfaceMuted: 'hsla(100, 13%, 92%, 1)',
    surfaceElevated: 'hsla(0, 0%, 100%, 1)',
    surfaceOverlay: 'hsla(0, 0%, 100%, 1)',

    text: 'hsla(160, 34%, 10%, 1)',
    textSecondary: 'hsla(160, 8%, 35%, 1)',
    icon: 'hsla(160, 10%, 30%, 1)',

    tint: 'hsla(38, 100%, 24%, 1)',
    tintHover: 'hsla(38, 100%, 20%, 1)',
    tintActive: 'hsla(42, 78%, 52%, 1)',
    tintSubtle: 'hsla(42, 78%, 52%, 0.16)',
    tintMuted: 'hsla(42, 78%, 52%, 0.30)',
    tintHighlight: 'hsla(42, 78%, 52%, 0.22)',
    onPrimary: 'hsla(160, 34%, 10%, 1)',
    onDestructive: 'hsla(0, 0%, 100%, 1)',
    onSuccess: 'hsla(0, 0%, 100%, 1)',
    onWarning: 'hsla(0, 0%, 100%, 1)',
    onInfo: 'hsla(0, 0%, 100%, 1)',
    onTintScrim: 'hsla(160, 34%, 10%, 0.32)',

    interactiveHover: 'hsla(160, 34%, 10%, 0.05)',
    interactivePress: 'hsla(160, 34%, 10%, 0.10)',

    border: 'hsla(160, 30%, 10%, 0.10)',
    outline: 'hsla(160, 30%, 10%, 0.18)',
    focusRing: 'hsla(38, 100%, 30%, 0.70)',

    tabIconDefault: 'hsla(160, 8%, 35%, 1)',
    tabIconSelected: 'hsla(160, 34%, 10%, 1)',

    destructive: 'hsla(356, 70%, 43%, 1)',
    destructiveActive: 'hsla(356, 72%, 41%, 1)',
    destructiveSurface: 'hsla(356, 70%, 43%, 0.10)',
    success: 'hsla(152, 62%, 25%, 1)',
    successSurface: 'hsla(152, 62%, 25%, 0.10)',
    warning: 'hsla(26, 92%, 34%, 1)',
    warningSurface: 'hsla(26, 92%, 34%, 0.10)',
    info: 'hsla(200, 80%, 30%, 1)',
    infoSurface: 'hsla(200, 80%, 30%, 0.10)',

    disabled: 'hsla(100, 8%, 88%, 1)',

    scrim: 'hsla(160, 40%, 6%, 0.52)',
    shadowColor: 'hsla(160, 40%, 6%, 0.14)',
  },
  dark: {
    background: 'hsla(160, 36%, 8%, 1)',
    surface: 'hsla(160, 28%, 12%, 1)',
    surfaceSunken: 'hsla(160, 40%, 5%, 1)',
    surfaceMuted: 'hsla(160, 22%, 16%, 1)',
    surfaceElevated: 'hsla(160, 24%, 15%, 1)',
    surfaceOverlay: 'hsla(160, 20%, 19%, 1)',

    text: 'hsla(60, 20%, 93%, 1)',
    textSecondary: 'hsla(140, 9%, 68%, 1)',
    icon: 'hsla(140, 10%, 78%, 1)',

    tint: 'hsla(42, 76%, 58%, 1)',
    tintHover: 'hsla(42, 84%, 66%, 1)',
    tintActive: 'hsla(42, 76%, 56%, 1)',
    tintSubtle: 'hsla(42, 76%, 58%, 0.12)',
    tintMuted: 'hsla(42, 76%, 58%, 0.26)',
    tintHighlight: 'hsla(42, 76%, 58%, 0.18)',
    onPrimary: 'hsla(160, 36%, 8%, 1)',
    onDestructive: 'hsla(0, 0%, 100%, 1)',
    onSuccess: 'hsla(160, 36%, 8%, 1)',
    onWarning: 'hsla(160, 36%, 8%, 1)',
    onInfo: 'hsla(160, 36%, 8%, 1)',
    onTintScrim: 'hsla(160, 40%, 4%, 0.40)',

    interactiveHover: 'hsla(60, 20%, 93%, 0.05)',
    interactivePress: 'hsla(60, 20%, 93%, 0.10)',

    border: 'hsla(60, 30%, 90%, 0.09)',
    outline: 'hsla(60, 30%, 90%, 0.17)',
    focusRing: 'hsla(42, 76%, 58%, 0.75)',

    tabIconDefault: 'hsla(140, 9%, 68%, 1)',
    tabIconSelected: 'hsla(42, 76%, 58%, 1)',

    destructive: 'hsla(358, 90%, 74%, 1)',
    destructiveActive: 'hsla(356, 66%, 46%, 1)',
    destructiveSurface: 'hsla(358, 90%, 74%, 0.14)',
    success: 'hsla(150, 52%, 56%, 1)',
    successSurface: 'hsla(150, 52%, 56%, 0.14)',
    warning: 'hsla(26, 92%, 62%, 1)',
    warningSurface: 'hsla(26, 92%, 62%, 0.14)',
    info: 'hsla(200, 74%, 68%, 1)',
    infoSurface: 'hsla(200, 74%, 68%, 0.14)',

    disabled: 'hsla(160, 16%, 19%, 1)',

    scrim: 'hsla(160, 40%, 3%, 0.72)',
    shadowColor: 'hsla(160, 40%, 2%, 0.50)',
  },
};
