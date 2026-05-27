import type { ColorPalette } from './types';

export const PURPLE: ColorPalette = {
  light: {
    background: '#ffffff',
    surface: '#fafaff',
    surfaceMuted: '#f3f0fa',
    surfaceElevated: '#ffffff',
    surfaceOverlay: '#ffffff',

    text: '#17131f',
    textSecondary: '#6c6580',
    icon: '#4a4458',

    tint: '#7c3aed',
    tintHover: '#6d28d9',
    tintActive: '#5b21b6',
    tintSubtle: 'rgba(124, 58, 237, 0.10)',
    tintMuted: 'rgba(124, 58, 237, 0.16)',
    onTint: '#ffffff',

    interactiveHover: 'rgba(23, 19, 31, 0.04)',
    interactivePress: 'rgba(23, 19, 31, 0.08)',

    border: 'rgba(23, 19, 31, 0.08)',
    outline: 'rgba(23, 19, 31, 0.16)',
    focusRing: 'rgba(124, 58, 237, 0.5)',

    tabIconDefault: 'rgba(108, 101, 128, 0.5)',
    tabIconSelected: '#7c3aed',

    destructive: '#e11d48',
    destructiveSurface: 'rgba(225, 29, 72, 0.10)',
    success: '#059669',
    successSurface: 'rgba(5, 150, 105, 0.10)',
    warning: '#f59e0b',
    warningSurface: 'rgba(245, 158, 11, 0.14)',
    info: '#8b5cf6',
    infoSurface: 'rgba(139, 92, 246, 0.12)',

    disabled: '#e7e5ec',

    scrim: 'rgba(23, 19, 31, 0.45)',
    shadowColor: 'rgba(23, 19, 31, 0.14)',

    gradientPrimaryStart: '#7c3aed',
    gradientPrimaryEnd: '#5b21b6',
    gradientDangerStart: '#e11d48',
    gradientDangerEnd: '#9f1239',
    gradientNeutralStart: '#3f3f46',
    gradientNeutralEnd: '#18181b',
  },
  dark: {
    background: '#0b0911',
    surface: '#171320',
    surfaceMuted: '#0f0c16',
    surfaceElevated: '#221c2e',
    surfaceOverlay: '#2d2540',

    text: '#f3f1f8',
    textSecondary: '#a39cb5',
    icon: '#c0bbd1',

    tint: '#a78bfa',
    tintHover: '#c4b5fd',
    tintActive: '#8b5cf6',
    tintSubtle: 'rgba(167, 139, 250, 0.14)',
    tintMuted: 'rgba(167, 139, 250, 0.24)',
    onTint: '#0a0a0a',

    interactiveHover: 'rgba(243, 241, 248, 0.06)',
    interactivePress: 'rgba(243, 241, 248, 0.12)',

    border: 'rgba(243, 241, 248, 0.08)',
    outline: 'rgba(243, 241, 248, 0.16)',
    focusRing: 'rgba(167, 139, 250, 0.6)',

    tabIconDefault: 'rgba(163, 156, 181, 0.5)',
    tabIconSelected: '#f3f1f8',

    destructive: '#fb7185',
    destructiveSurface: 'rgba(251, 113, 133, 0.16)',
    success: '#34d399',
    successSurface: 'rgba(52, 211, 153, 0.14)',
    warning: '#fbbf24',
    warningSurface: 'rgba(251, 191, 36, 0.18)',
    info: '#c4b5fd',
    infoSurface: 'rgba(196, 181, 253, 0.14)',

    disabled: '#2a2438',

    scrim: 'rgba(0, 0, 0, 0.65)',
    shadowColor: 'rgba(0, 0, 0, 0.55)',

    gradientPrimaryStart: '#7c3aed',
    gradientPrimaryEnd: '#5b21b6',
    gradientDangerStart: '#e11d48',
    gradientDangerEnd: '#9f1239',
    gradientNeutralStart: '#52525b',
    gradientNeutralEnd: '#27272a',
  },
};
