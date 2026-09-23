import type { ColorPalette } from './types';

/**
 * Game palette — warm tabletop in light, plum-night lobby in dark, one candy
 * violet brand. Every value is `hsla(h, s%, l%, a)` so a retune is a hue or
 * lightness edit in this file (`bun run --filter @pkgs/ui tokens:generate`
 * rewrites `tokens.css`). Components paint with `var(--ui-color-*)` only.
 *
 * Hue families:
 *   - Neutrals: plum ~276° (not zinc). Light sits on warm paper, dark on ink.
 *   - Brand:    284° deep violet (light) / 286° luminous candy (dark)
 *   - Danger:   348–350° hot coral
 *   - Success:  158° arcade green
 *   - Warning:  36–42° gold
 *   - Info:     188–192° teal
 *
 * Contrast (each pair ≥ 4.5:1): `text` on every surface, `tint` as text on
 * `background`, and each `on*` fill (`onPrimary` on `tint` / hover / active,
 * and the same for destructive, success, warning, info). Dark `onPrimary` is
 * ink on candy, not white — the bright brand would fail white text.
 */
export const COLOR_PALETTE: ColorPalette = {
  light: {
    background: 'hsla(32, 55%, 97%, 1)',
    surface: 'hsla(30, 45%, 99%, 1)',
    surfaceSunken: 'hsla(278, 28%, 94%, 1)',
    surfaceMuted: 'hsla(278, 24%, 92%, 1)',
    surfaceElevated: 'hsla(0, 0%, 100%, 1)',
    surfaceOverlay: 'hsla(0, 0%, 100%, 1)',

    text: 'hsla(278, 48%, 14%, 1)',
    textSecondary: 'hsla(274, 14%, 38%, 1)',
    icon: 'hsla(274, 22%, 32%, 1)',

    tint: 'hsla(284, 78%, 42%, 1)',
    tintHover: 'hsla(284, 80%, 36%, 1)',
    tintActive: 'hsla(284, 82%, 30%, 1)',
    tintSubtle: 'hsla(284, 78%, 42%, 0.12)',
    tintMuted: 'hsla(284, 78%, 42%, 0.20)',
    tintHighlight: 'hsla(284, 78%, 42%, 0.16)',
    onPrimary: 'hsla(0, 0%, 100%, 1)',
    onDestructive: 'hsla(0, 0%, 100%, 1)',
    onSuccess: 'hsla(0, 0%, 100%, 1)',
    onWarning: 'hsla(278, 48%, 14%, 1)',
    onInfo: 'hsla(0, 0%, 100%, 1)',
    onTintScrim: 'hsla(278, 48%, 14%, 0.32)',

    interactiveHover: 'hsla(278, 48%, 14%, 0.05)',
    interactivePress: 'hsla(278, 48%, 14%, 0.09)',

    border: 'hsla(278, 40%, 14%, 0.08)',
    outline: 'hsla(278, 40%, 14%, 0.16)',
    focusRing: 'hsla(284, 78%, 42%, 0.45)',

    tabIconDefault: 'hsla(274, 16%, 40%, 0.70)',
    tabIconSelected: 'hsla(284, 78%, 42%, 1)',

    destructive: 'hsla(348, 82%, 46%, 1)',
    destructiveActive: 'hsla(348, 84%, 38%, 1)',
    destructiveSurface: 'hsla(348, 82%, 46%, 0.12)',
    success: 'hsla(158, 72%, 28%, 1)',
    successSurface: 'hsla(158, 72%, 28%, 0.12)',
    warning: 'hsla(36, 96%, 40%, 1)',
    warningSurface: 'hsla(36, 96%, 40%, 0.16)',
    info: 'hsla(192, 85%, 30%, 1)',
    infoSurface: 'hsla(192, 85%, 30%, 0.12)',

    disabled: 'hsla(278, 18%, 90%, 1)',

    scrim: 'hsla(278, 48%, 10%, 0.48)',
    shadowColor: 'hsla(278, 48%, 14%, 0.12)',
  },
  dark: {
    background: 'hsla(276, 46%, 7%, 1)',
    surface: 'hsla(274, 38%, 12%, 1)',
    surfaceSunken: 'hsla(276, 46%, 6%, 1)',
    surfaceMuted: 'hsla(274, 30%, 17%, 1)',
    surfaceElevated: 'hsla(274, 32%, 16%, 1)',
    surfaceOverlay: 'hsla(274, 28%, 20%, 1)',

    text: 'hsla(36, 60%, 97%, 1)',
    textSecondary: 'hsla(276, 18%, 74%, 1)',
    icon: 'hsla(276, 22%, 86%, 1)',

    tint: 'hsla(286, 100%, 76%, 1)',
    tintHover: 'hsla(286, 100%, 82%, 1)',
    tintActive: 'hsla(286, 92%, 68%, 1)',
    tintSubtle: 'hsla(286, 100%, 76%, 0.16)',
    tintMuted: 'hsla(286, 100%, 76%, 0.28)',
    tintHighlight: 'hsla(286, 100%, 76%, 0.22)',
    onPrimary: 'hsla(278, 55%, 12%, 1)',
    onDestructive: 'hsla(278, 55%, 12%, 1)',
    onSuccess: 'hsla(278, 55%, 12%, 1)',
    onWarning: 'hsla(278, 55%, 12%, 1)',
    onInfo: 'hsla(278, 55%, 12%, 1)',
    onTintScrim: 'hsla(0, 0%, 0%, 0.40)',

    interactiveHover: 'hsla(36, 60%, 97%, 0.06)',
    interactivePress: 'hsla(36, 60%, 97%, 0.12)',

    border: 'hsla(36, 40%, 97%, 0.10)',
    outline: 'hsla(36, 40%, 97%, 0.16)',
    focusRing: 'hsla(286, 100%, 76%, 0.55)',

    tabIconDefault: 'hsla(276, 14%, 74%, 0.65)',
    tabIconSelected: 'hsla(286, 100%, 76%, 1)',

    destructive: 'hsla(350, 100%, 70%, 1)',
    destructiveActive: 'hsla(350, 90%, 60%, 1)',
    destructiveSurface: 'hsla(350, 100%, 70%, 0.16)',
    success: 'hsla(158, 72%, 62%, 1)',
    successSurface: 'hsla(158, 72%, 62%, 0.16)',
    warning: 'hsla(42, 100%, 62%, 1)',
    warningSurface: 'hsla(42, 100%, 62%, 0.18)',
    info: 'hsla(188, 95%, 62%, 1)',
    infoSurface: 'hsla(188, 95%, 62%, 0.16)',

    disabled: 'hsla(274, 18%, 22%, 1)',

    scrim: 'hsla(276, 50%, 4%, 0.72)',
    shadowColor: 'hsla(276, 50%, 2%, 0.50)',
  },
};
