import type { ColorPalette } from './types';

export const CLAUDE: ColorPalette = {
  light: {
    // Surfaces
    surface: '#FFFFFF',
    background: '#F5F4EF', // warm off-white page bg
    border: '#E8E6DF',
    outline: '#D0CEC6',

    // Text
    text: '#1A1915',
    textSecondary: '#6B6860',

    // Brand
    tint: '#D97757', // Claude's coral/terracotta accent
    tintMuted: '#F5E6DF',
    icon: '#6B6860',

    // Tabs
    tabIconDefault: '#A8A49C',
    tabIconSelected: '#D97757',

    // Semantic
    destructive: '#C0392B',
    success: '#2E7D52',
    warning: '#B45309',
    info: '#1D6FA4',
    disabled: '#C4C2BB',

    // Gradients — dark stops so light text sits on top
    gradientPrimaryStart: '#CC6B47',
    gradientPrimaryEnd: '#B85A38',
    gradientDangerStart: '#C0392B',
    gradientDangerEnd: '#922B21',
    gradientNeutralStart: '#3D3B36',
    gradientNeutralEnd: '#1A1915',
  },

  dark: {
    // Surfaces
    surface: '#2C2B27',
    background: '#1A1915', // very dark warm near-black
    border: '#3A3832',
    outline: '#4A4840',

    // Text
    text: '#F0EEE8',
    textSecondary: '#A8A49C',

    // Brand
    tint: '#E8896A', // slightly lighter coral for dark bg
    tintMuted: '#3D2920',
    icon: '#A8A49C',

    // Tabs
    tabIconDefault: '#6B6860',
    tabIconSelected: '#E8896A',

    // Semantic
    destructive: '#E05C4B',
    success: '#4CAF7D',
    warning: '#F59E0B',
    info: '#4BA3D4',
    disabled: '#4A4840',

    // Gradients
    gradientPrimaryStart: '#E8896A',
    gradientPrimaryEnd: '#CC6B47',
    gradientDangerStart: '#E05C4B',
    gradientDangerEnd: '#C0392B',
    gradientNeutralStart: '#4A4840',
    gradientNeutralEnd: '#2C2B27',
  },
};
