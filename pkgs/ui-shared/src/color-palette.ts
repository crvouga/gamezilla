import type { ColorPalette } from './colors-types';

/**
 * Neutral cool-gray surfaces and a blue brand. Solid primary fills use
 * `tintActive` with white `onPrimary` in both schemes (buttons, badges,
 * space cards). `tint` is the text/link accent: in dark mode it is lighter
 * than the fill so it stays readable on the canvas. White on that lighter
 * blue would fail, so solid buttons do not use it.
 *
 * Retune here, then `bun run --filter @pkgs/ui-server tokens:generate`.
 * Every text/fill pair below is at least 4.5:1.
 */
export const COLOR_PALETTE: ColorPalette = {
  light: {
    background: 'hsla(220, 12%, 98%, 1)',
    surface: 'hsla(220, 10%, 96%, 1)',
    surfaceSunken: 'hsla(220, 8%, 94%, 1)',
    surfaceMuted: 'hsla(220, 8%, 92%, 1)',
    surfaceElevated: 'hsla(0, 0%, 100%, 1)',
    surfaceOverlay: 'hsla(0, 0%, 100%, 1)',

    text: 'hsla(222, 12%, 14%, 1)',
    textSecondary: 'hsla(220, 5%, 40%, 1)',
    icon: 'hsla(220, 5%, 34%, 1)',

    tint: 'hsla(217, 70%, 44%, 1)',
    tintHover: 'hsla(217, 72%, 38%, 1)',
    tintActive: 'hsla(217, 74%, 40%, 1)',
    tintSubtle: 'hsla(217, 70%, 44%, 0.12)',
    tintMuted: 'hsla(217, 70%, 44%, 0.20)',
    tintHighlight: 'hsla(217, 70%, 44%, 0.16)',
    onPrimary: 'hsla(0, 0%, 100%, 1)',
    onDestructive: 'hsla(0, 0%, 100%, 1)',
    onSuccess: 'hsla(0, 0%, 100%, 1)',
    onWarning: 'hsla(222, 12%, 14%, 1)',
    onInfo: 'hsla(0, 0%, 100%, 1)',
    onTintScrim: 'hsla(222, 12%, 14%, 0.32)',

    interactiveHover: 'hsla(222, 12%, 14%, 0.05)',
    interactivePress: 'hsla(222, 12%, 14%, 0.09)',

    border: 'hsla(220, 10%, 14%, 0.08)',
    outline: 'hsla(220, 10%, 14%, 0.14)',
    focusRing: 'hsla(217, 70%, 44%, 0.45)',

    tabIconDefault: 'hsla(220, 5%, 40%, 0.70)',
    tabIconSelected: 'hsla(217, 70%, 44%, 1)',

    destructive: 'hsla(0, 68%, 46%, 1)',
    destructiveActive: 'hsla(0, 70%, 40%, 1)',
    destructiveSurface: 'hsla(0, 68%, 46%, 0.12)',
    success: 'hsla(152, 55%, 28%, 1)',
    successSurface: 'hsla(152, 55%, 28%, 0.12)',
    warning: 'hsla(38, 90%, 42%, 1)',
    warningSurface: 'hsla(38, 90%, 42%, 0.16)',
    info: 'hsla(199, 72%, 34%, 1)',
    infoSurface: 'hsla(199, 72%, 34%, 0.12)',

    disabled: 'hsla(220, 6%, 90%, 1)',

    scrim: 'hsla(222, 16%, 10%, 0.48)',
    shadowColor: 'hsla(222, 16%, 10%, 0.12)',
  },
  dark: {
    background: 'hsla(220, 8%, 9%, 1)',
    surface: 'hsla(220, 7%, 13%, 1)',
    surfaceSunken: 'hsla(220, 8%, 7%, 1)',
    surfaceMuted: 'hsla(220, 6%, 17%, 1)',
    surfaceElevated: 'hsla(220, 6%, 18%, 1)',
    surfaceOverlay: 'hsla(220, 5%, 22%, 1)',

    text: 'hsla(210, 16%, 97%, 1)',
    textSecondary: 'hsla(215, 6%, 70%, 1)',
    icon: 'hsla(215, 8%, 82%, 1)',

    tint: 'hsla(213, 92%, 68%, 1)',
    tintHover: 'hsla(213, 94%, 74%, 1)',
    tintActive: 'hsla(217, 78%, 44%, 1)',
    tintSubtle: 'hsla(213, 92%, 68%, 0.16)',
    tintMuted: 'hsla(213, 92%, 68%, 0.28)',
    tintHighlight: 'hsla(213, 92%, 68%, 0.22)',
    onPrimary: 'hsla(0, 0%, 100%, 1)',
    onDestructive: 'hsla(222, 16%, 12%, 1)',
    onSuccess: 'hsla(222, 16%, 12%, 1)',
    onWarning: 'hsla(222, 16%, 12%, 1)',
    onInfo: 'hsla(222, 16%, 12%, 1)',
    onTintScrim: 'hsla(0, 0%, 0%, 0.40)',

    interactiveHover: 'hsla(210, 16%, 97%, 0.06)',
    interactivePress: 'hsla(210, 16%, 97%, 0.12)',

    border: 'hsla(210, 14%, 96%, 0.10)',
    outline: 'hsla(210, 14%, 96%, 0.16)',
    focusRing: 'hsla(213, 92%, 68%, 0.55)',

    tabIconDefault: 'hsla(215, 6%, 70%, 0.65)',
    tabIconSelected: 'hsla(213, 92%, 68%, 1)',

    destructive: 'hsla(0, 78%, 62%, 1)',
    destructiveActive: 'hsla(0, 72%, 52%, 1)',
    destructiveSurface: 'hsla(0, 78%, 62%, 0.16)',
    success: 'hsla(152, 52%, 48%, 1)',
    successSurface: 'hsla(152, 52%, 48%, 0.16)',
    warning: 'hsla(40, 92%, 56%, 1)',
    warningSurface: 'hsla(40, 92%, 56%, 0.18)',
    info: 'hsla(199, 84%, 58%, 1)',
    infoSurface: 'hsla(199, 84%, 58%, 0.16)',

    disabled: 'hsla(220, 5%, 22%, 1)',

    scrim: 'hsla(220, 14%, 4%, 0.72)',
    shadowColor: 'hsla(220, 14%, 2%, 0.50)',
  },
};
