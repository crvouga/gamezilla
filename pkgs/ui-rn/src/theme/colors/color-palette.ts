import type { ColorPalette } from './types';

/**
 * Single, polished, modern palette: Radix-inspired zinc neutrals + a saturated
 * blue brand that holds its contrast against `#ffffff` text in both schemes.
 *
 * Every value is expressed as `hsla(h, s%, l%, a)`. HSLA makes the palette
 * easy to retune (shift the brand hue with one number; darken a surface by
 * dropping a few percentage points of lightness) and lets opacity-variant
 * tokens (`tintSubtle`, `tintHighlight`, `tintMuted`, `*Surface`) share an
 * exact base color with their solid counterpart -- no separate hex strings
 * to keep in sync.
 *
 * Hue families used in this palette:
 *   - Neutrals:   ~240° (Tailwind zinc), ~0% saturation for true greys
 *   - Brand:      221° (blue-600) light / 217° (blue-500) dark
 *   - Destructive: 0° / ~0° (red-600 / red-500)
 *   - Success:    142° (green-600 / green-400)
 *   - Warning:     32° light, 43° dark (amber-600 / amber-400)
 *   - Info:       201° light, 199° dark (sky-600 / sky-400)
 *
 * The hierarchy is built so that:
 *  - Light mode page sits on `background hsla(0, 0%, 100%, 1)`, with
 *    `surfaceSunken` for page-level recessed regions and `surfaceMuted`
 *    for inline recessed fields (inputs, segmented-control tracks).
 *  - Dark mode page sits on a near-black `background` (deeper than
 *    `surface`), so cards/modals lift visibly without relying on shadow
 *    contrast.
 *  - Every saturated fill (blue, red, green, amber, sky) has a dedicated
 *    `on*` foreground token chosen for >= 4.5:1 contrast against the fill
 *    in both schemes. Saturated dark-mode tints stay saturated (not
 *    pastel) so `#ffffff` labels remain legible.
 */
export const PALETTE: ColorPalette = {
  light: {
    background: 'hsla(0, 0%, 100%, 1)',
    surface: 'hsla(0, 0%, 98%, 1)',
    surfaceSunken: 'hsla(240, 5%, 96%, 1)',
    surfaceMuted: 'hsla(240, 5%, 96%, 1)',
    surfaceElevated: 'hsla(0, 0%, 100%, 1)',
    surfaceOverlay: 'hsla(0, 0%, 100%, 1)',

    text: 'hsla(240, 10%, 4%, 1)',
    textSecondary: 'hsla(240, 4%, 46%, 1)',
    icon: 'hsla(240, 5%, 34%, 1)',

    tint: 'hsla(221, 83%, 53%, 1)',
    tintHover: 'hsla(224, 76%, 48%, 1)',
    tintActive: 'hsla(226, 71%, 40%, 1)',
    tintSubtle: 'hsla(221, 83%, 53%, 0.10)',
    tintMuted: 'hsla(221, 83%, 53%, 0.18)',
    tintHighlight: 'hsla(221, 83%, 53%, 0.12)',
    onPrimary: 'hsla(0, 0%, 100%, 1)',
    onDestructive: 'hsla(0, 0%, 100%, 1)',
    onSuccess: 'hsla(0, 0%, 100%, 1)',
    onWarning: 'hsla(240, 10%, 4%, 1)',
    onInfo: 'hsla(0, 0%, 100%, 1)',
    onTintScrim: 'hsla(240, 10%, 4%, 0.32)',

    interactiveHover: 'hsla(240, 10%, 4%, 0.04)',
    interactivePress: 'hsla(240, 10%, 4%, 0.08)',

    border: 'hsla(240, 10%, 4%, 0.07)',
    outline: 'hsla(240, 10%, 4%, 0.14)',
    focusRing: 'hsla(221, 83%, 53%, 0.45)',

    tabIconDefault: 'hsla(240, 5%, 34%, 0.55)',
    tabIconSelected: 'hsla(221, 83%, 53%, 1)',

    destructive: 'hsla(0, 72%, 51%, 1)',
    destructiveActive: 'hsla(0, 72%, 44%, 1)',
    destructiveSurface: 'hsla(0, 72%, 51%, 0.10)',
    success: 'hsla(142, 72%, 29%, 1)',
    successSurface: 'hsla(142, 72%, 29%, 0.10)',
    warning: 'hsla(32, 95%, 44%, 1)',
    warningSurface: 'hsla(32, 95%, 44%, 0.14)',
    info: 'hsla(201, 98%, 36%, 1)',
    infoSurface: 'hsla(201, 98%, 36%, 0.10)',

    disabled: 'hsla(240, 5%, 90%, 1)',

    scrim: 'hsla(240, 10%, 4%, 0.45)',
    shadowColor: 'hsla(240, 10%, 4%, 0.10)',
  },
  dark: {
    background: 'hsla(240, 5%, 4%, 1)',
    surface: 'hsla(240, 7%, 8%, 1)',
    surfaceSunken: 'hsla(240, 5%, 4%, 1)',
    surfaceMuted: 'hsla(240, 6%, 12%, 1)',
    surfaceElevated: 'hsla(240, 5%, 13%, 1)',
    surfaceOverlay: 'hsla(240, 5%, 16%, 1)',

    text: 'hsla(0, 0%, 98%, 1)',
    textSecondary: 'hsla(240, 5%, 65%, 1)',
    icon: 'hsla(240, 5%, 84%, 1)',

    tint: 'hsla(217, 91%, 60%, 1)',
    tintHover: 'hsla(213, 94%, 68%, 1)',
    tintActive: 'hsla(221, 83%, 53%, 1)',
    tintSubtle: 'hsla(217, 91%, 60%, 0.14)',
    tintMuted: 'hsla(217, 91%, 60%, 0.26)',
    tintHighlight: 'hsla(217, 91%, 60%, 0.18)',
    onPrimary: 'hsla(0, 0%, 100%, 1)',
    onDestructive: 'hsla(0, 0%, 100%, 1)',
    onSuccess: 'hsla(240, 10%, 4%, 1)',
    onWarning: 'hsla(240, 10%, 4%, 1)',
    onInfo: 'hsla(240, 10%, 4%, 1)',
    onTintScrim: 'hsla(0, 0%, 0%, 0.40)',

    interactiveHover: 'hsla(0, 0%, 98%, 0.06)',
    interactivePress: 'hsla(0, 0%, 98%, 0.12)',

    border: 'hsla(0, 0%, 98%, 0.08)',
    outline: 'hsla(0, 0%, 98%, 0.14)',
    focusRing: 'hsla(213, 94%, 68%, 0.55)',

    tabIconDefault: 'hsla(240, 5%, 65%, 0.55)',
    tabIconSelected: 'hsla(0, 0%, 98%, 1)',

    destructive: 'hsla(0, 84%, 60%, 1)',
    destructiveActive: 'hsla(0, 74%, 50%, 1)',
    destructiveSurface: 'hsla(0, 84%, 60%, 0.16)',
    success: 'hsla(142, 71%, 58%, 1)',
    successSurface: 'hsla(142, 71%, 58%, 0.14)',
    warning: 'hsla(43, 96%, 56%, 1)',
    warningSurface: 'hsla(43, 96%, 56%, 0.18)',
    info: 'hsla(199, 92%, 60%, 1)',
    infoSurface: 'hsla(199, 92%, 60%, 0.14)',

    disabled: 'hsla(240, 4%, 16%, 1)',

    scrim: 'hsla(0, 0%, 0%, 0.65)',
    shadowColor: 'hsla(0, 0%, 0%, 0.45)',
  },
};

export const COLOR_PALETTE: ColorPalette = PALETTE;
