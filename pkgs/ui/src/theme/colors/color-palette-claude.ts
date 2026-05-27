import type { ColorPalette } from './types';

export const CLAUDE: ColorPalette = {
  light: {
    background: '#F5F4EF',
    surface: '#FFFFFF',
    surfaceMuted: '#ECEAE2',
    surfaceElevated: '#FFFFFF',
    surfaceOverlay: '#FFFFFF',

    text: '#1A1915',
    textSecondary: '#6B6860',
    icon: '#6B6860',

    tint: '#D97757',
    tintHover: '#CC6B47',
    tintActive: '#B85A38',
    tintSubtle: 'rgba(217, 119, 87, 0.10)',
    tintMuted: 'rgba(217, 119, 87, 0.18)',
    onTint: '#FFFFFF',

    interactiveHover: 'rgba(26, 25, 21, 0.04)',
    interactivePress: 'rgba(26, 25, 21, 0.08)',

    border: '#E8E6DF',
    outline: '#D0CEC6',
    focusRing: 'rgba(217, 119, 87, 0.5)',

    tabIconDefault: '#A8A49C',
    tabIconSelected: '#D97757',

    destructive: '#C0392B',
    destructiveSurface: 'rgba(192, 57, 43, 0.10)',
    success: '#2E7D52',
    successSurface: 'rgba(46, 125, 82, 0.10)',
    warning: '#B45309',
    warningSurface: 'rgba(180, 83, 9, 0.12)',
    info: '#1D6FA4',
    infoSurface: 'rgba(29, 111, 164, 0.10)',

    disabled: '#C4C2BB',

    scrim: 'rgba(26, 25, 21, 0.45)',
    shadowColor: 'rgba(26, 25, 21, 0.14)',

    gradientPrimaryStart: '#CC6B47',
    gradientPrimaryEnd: '#B85A38',
    gradientDangerStart: '#C0392B',
    gradientDangerEnd: '#922B21',
    gradientNeutralStart: '#3D3B36',
    gradientNeutralEnd: '#1A1915',
  },

  dark: {
    background: '#1A1915',
    surface: '#2C2B27',
    surfaceMuted: '#211F1B',
    surfaceElevated: '#3A3832',
    surfaceOverlay: '#4A4840',

    text: '#F0EEE8',
    textSecondary: '#A8A49C',
    icon: '#A8A49C',

    tint: '#E8896A',
    tintHover: '#F19D80',
    tintActive: '#D97757',
    tintSubtle: 'rgba(232, 137, 106, 0.14)',
    tintMuted: 'rgba(232, 137, 106, 0.24)',
    onTint: '#1A1915',

    interactiveHover: 'rgba(240, 238, 232, 0.06)',
    interactivePress: 'rgba(240, 238, 232, 0.12)',

    border: '#3A3832',
    outline: '#4A4840',
    focusRing: 'rgba(232, 137, 106, 0.6)',

    tabIconDefault: '#6B6860',
    tabIconSelected: '#E8896A',

    destructive: '#E05C4B',
    destructiveSurface: 'rgba(224, 92, 75, 0.16)',
    success: '#4CAF7D',
    successSurface: 'rgba(76, 175, 125, 0.14)',
    warning: '#F59E0B',
    warningSurface: 'rgba(245, 158, 11, 0.16)',
    info: '#4BA3D4',
    infoSurface: 'rgba(75, 163, 212, 0.14)',

    disabled: '#4A4840',

    scrim: 'rgba(0, 0, 0, 0.6)',
    shadowColor: 'rgba(0, 0, 0, 0.5)',

    gradientPrimaryStart: '#E8896A',
    gradientPrimaryEnd: '#CC6B47',
    gradientDangerStart: '#E05C4B',
    gradientDangerEnd: '#C0392B',
    gradientNeutralStart: '#4A4840',
    gradientNeutralEnd: '#2C2B27',
  },
};
