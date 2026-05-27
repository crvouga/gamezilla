import type { ColorPalette } from './types';

/**
 * Default "refined-playful" palette: zinc neutrals + blue tint, sized for
 * Discord/Figma-style polish. Surface tiers honor the historical convention
 * (`background` is the page; `surface` sits one tier "above" it -- slightly
 * recessed gray in light, slightly raised in dark). Higher tiers
 * (`surfaceElevated`, `surfaceOverlay`) lift further so dark-mode elevation
 * reads via lighter surfaces (Material 3) instead of relying on shadows
 * alone.
 */
export const BLUE: ColorPalette = {
  light: {
    background: '#ffffff',
    surface: '#fafafa',
    surfaceMuted: '#f4f4f5',
    surfaceElevated: '#ffffff',
    surfaceOverlay: '#ffffff',

    text: '#09090b',
    textSecondary: '#71717a',
    icon: '#52525b',

    tint: '#2563eb',
    tintHover: '#1d4ed8',
    tintActive: '#1e40af',
    tintSubtle: 'rgba(37, 99, 235, 0.10)',
    tintMuted: 'rgba(37, 99, 235, 0.18)',
    onTint: '#ffffff',

    interactiveHover: 'rgba(9, 9, 11, 0.04)',
    interactivePress: 'rgba(9, 9, 11, 0.08)',

    border: 'rgba(9, 9, 11, 0.08)',
    outline: 'rgba(9, 9, 11, 0.16)',
    focusRing: 'rgba(37, 99, 235, 0.5)',

    tabIconDefault: 'rgba(82, 82, 91, 0.5)',
    tabIconSelected: '#2563eb',

    destructive: '#e11d48',
    destructiveSurface: 'rgba(225, 29, 72, 0.10)',
    success: '#059669',
    successSurface: 'rgba(5, 150, 105, 0.10)',
    warning: '#f59e0b',
    warningSurface: 'rgba(245, 158, 11, 0.14)',
    info: '#0ea5e9',
    infoSurface: 'rgba(14, 165, 233, 0.10)',

    disabled: '#e4e4e7',

    scrim: 'rgba(9, 9, 11, 0.45)',
    shadowColor: 'rgba(9, 9, 11, 0.14)',

    gradientPrimaryStart: '#2563eb',
    gradientPrimaryEnd: '#1d4ed8',
    gradientDangerStart: '#e11d48',
    gradientDangerEnd: '#9f1239',
    gradientNeutralStart: '#3f3f46',
    gradientNeutralEnd: '#18181b',
  },
  dark: {
    background: '#09090b',
    surface: '#18181b',
    surfaceMuted: '#0d0d0f',
    surfaceElevated: '#27272a',
    surfaceOverlay: '#3f3f46',

    text: '#fafafa',
    textSecondary: '#a1a1aa',
    icon: '#d4d4d8',

    tint: '#60a5fa',
    tintHover: '#93c5fd',
    tintActive: '#3b82f6',
    tintSubtle: 'rgba(96, 165, 250, 0.14)',
    tintMuted: 'rgba(96, 165, 250, 0.26)',
    onTint: '#0a0a0a',

    interactiveHover: 'rgba(250, 250, 250, 0.06)',
    interactivePress: 'rgba(250, 250, 250, 0.12)',

    border: 'rgba(250, 250, 250, 0.08)',
    outline: 'rgba(250, 250, 250, 0.16)',
    focusRing: 'rgba(96, 165, 250, 0.6)',

    tabIconDefault: 'rgba(161, 161, 170, 0.55)',
    tabIconSelected: '#fafafa',

    destructive: '#fb7185',
    destructiveSurface: 'rgba(251, 113, 133, 0.16)',
    success: '#34d399',
    successSurface: 'rgba(52, 211, 153, 0.14)',
    warning: '#fbbf24',
    warningSurface: 'rgba(251, 191, 36, 0.18)',
    info: '#38bdf8',
    infoSurface: 'rgba(56, 189, 248, 0.14)',

    disabled: '#3f3f46',

    scrim: 'rgba(0, 0, 0, 0.65)',
    shadowColor: 'rgba(0, 0, 0, 0.5)',

    gradientPrimaryStart: '#2563eb',
    gradientPrimaryEnd: '#1d4ed8',
    gradientDangerStart: '#e11d48',
    gradientDangerEnd: '#9f1239',
    gradientNeutralStart: '#52525b',
    gradientNeutralEnd: '#27272a',
  },
};
