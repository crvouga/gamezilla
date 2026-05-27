import type { ColorPalette } from './types';

/**
 * Neo-brutalist palette: stark high-contrast neutrals, raw paper-white
 * surfaces, and a deep hot-pink primary. Borders and outlines lean heavy
 * and opaque to support the chunky-block aesthetic. Yellow is reserved
 * for the `warning` token where it pairs against dark text.
 *
 * Contrast contract: the `tint` is used as a fill behind `surface`-colored
 * text/icons (chips, switches, modal buttons), so it must contrast against
 * `surface`. Stops for `gradientPrimary*` stay dark in both schemes per
 * the type contract (light text on top).
 */
export const BRUTALISM: ColorPalette = {
  light: {
    background: '#ffffff',
    surface: '#f5f1e8',
    surfaceMuted: '#ece7d6',
    surfaceElevated: '#ffffff',
    surfaceOverlay: '#ffffff',

    text: '#000000',
    textSecondary: '#1a1a1a',
    icon: '#000000',

    tint: '#c2185b',
    tintHover: '#a3174e',
    tintActive: '#880e4f',
    tintSubtle: 'rgba(194, 24, 91, 0.10)',
    tintMuted: 'rgba(194, 24, 91, 0.18)',
    onTint: '#ffffff',

    interactiveHover: 'rgba(0, 0, 0, 0.06)',
    interactivePress: 'rgba(0, 0, 0, 0.12)',

    border: 'rgba(0, 0, 0, 0.9)',
    outline: 'rgba(0, 0, 0, 1)',
    focusRing: '#c2185b',

    tabIconDefault: 'rgba(0, 0, 0, 0.6)',
    tabIconSelected: '#c2185b',

    destructive: '#d4213d',
    destructiveSurface: 'rgba(212, 33, 61, 0.14)',
    success: '#15803d',
    successSurface: 'rgba(21, 128, 61, 0.14)',
    warning: '#ffde59',
    warningSurface: 'rgba(255, 222, 89, 0.30)',
    info: '#0369a1',
    infoSurface: 'rgba(3, 105, 161, 0.12)',

    disabled: '#d4d4d4',

    scrim: 'rgba(0, 0, 0, 0.55)',
    shadowColor: 'rgba(0, 0, 0, 1)',

    gradientPrimaryStart: '#c2185b',
    gradientPrimaryEnd: '#880e4f',
    gradientDangerStart: '#d4213d',
    gradientDangerEnd: '#8a0a1f',
    gradientNeutralStart: '#1a1a1a',
    gradientNeutralEnd: '#000000',
  },
  dark: {
    background: '#000000',
    surface: '#1a1a1a',
    surfaceMuted: '#0d0d0d',
    surfaceElevated: '#2a2a2a',
    surfaceOverlay: '#3a3a3a',

    text: '#ffffff',
    textSecondary: '#e5e5e5',
    icon: '#ffffff',

    tint: '#ff5c8a',
    tintHover: '#ff7aa1',
    tintActive: '#c2185b',
    tintSubtle: 'rgba(255, 92, 138, 0.14)',
    tintMuted: 'rgba(255, 92, 138, 0.26)',
    onTint: '#000000',

    interactiveHover: 'rgba(255, 255, 255, 0.08)',
    interactivePress: 'rgba(255, 255, 255, 0.16)',

    border: 'rgba(255, 255, 255, 0.9)',
    outline: 'rgba(255, 255, 255, 1)',
    focusRing: '#ff5c8a',

    tabIconDefault: 'rgba(229, 229, 229, 0.6)',
    tabIconSelected: '#ff5c8a',

    destructive: '#ff5252',
    destructiveSurface: 'rgba(255, 82, 82, 0.18)',
    success: '#4ade80',
    successSurface: 'rgba(74, 222, 128, 0.16)',
    warning: '#ffde59',
    warningSurface: 'rgba(255, 222, 89, 0.20)',
    info: '#38bdf8',
    infoSurface: 'rgba(56, 189, 248, 0.16)',

    disabled: '#404040',

    scrim: 'rgba(0, 0, 0, 0.75)',
    shadowColor: 'rgba(0, 0, 0, 1)',

    gradientPrimaryStart: '#c2185b',
    gradientPrimaryEnd: '#880e4f',
    gradientDangerStart: '#d4213d',
    gradientDangerEnd: '#8a0a1f',
    gradientNeutralStart: '#27272a',
    gradientNeutralEnd: '#0a0a0a',
  },
};
