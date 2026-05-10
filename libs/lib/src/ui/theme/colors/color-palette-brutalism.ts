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
    surface: '#f5f1e8',
    background: '#ffffff',
    text: '#000000',
    textSecondary: '#1a1a1a',
    tint: '#c2185b',
    icon: '#000000',
    border: 'rgba(0, 0, 0, 0.9)',
    outline: 'rgba(0, 0, 0, 1)',
    tintMuted: 'rgba(194, 24, 91, 0.18)',
    tabIconDefault: 'rgba(0, 0, 0, 0.6)',
    tabIconSelected: '#c2185b',
    destructive: '#d4213d',
    success: '#15803d',
    warning: '#ffde59',
    info: '#0369a1',
    disabled: '#d4d4d4',
    gradientPrimaryStart: '#c2185b',
    gradientPrimaryEnd: '#880e4f',
    gradientDangerStart: '#d4213d',
    gradientDangerEnd: '#8a0a1f',
    gradientNeutralStart: '#1a1a1a',
    gradientNeutralEnd: '#000000',
  },
  dark: {
    surface: '#1a1a1a',
    background: '#000000',
    text: '#ffffff',
    textSecondary: '#e5e5e5',
    tint: '#ff5c8a',
    icon: '#ffffff',
    border: 'rgba(255, 255, 255, 0.9)',
    outline: 'rgba(255, 255, 255, 1)',
    tintMuted: 'rgba(255, 92, 138, 0.26)',
    tabIconDefault: 'rgba(229, 229, 229, 0.6)',
    tabIconSelected: '#ff5c8a',
    destructive: '#ff5252',
    success: '#4ade80',
    warning: '#ffde59',
    info: '#38bdf8',
    disabled: '#404040',
    gradientPrimaryStart: '#c2185b',
    gradientPrimaryEnd: '#880e4f',
    gradientDangerStart: '#d4213d',
    gradientDangerEnd: '#8a0a1f',
    gradientNeutralStart: '#27272a',
    gradientNeutralEnd: '#0a0a0a',
  },
};
