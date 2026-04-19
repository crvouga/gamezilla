/**
 * Prebuilt light/dark color palettes.
 * App-agnostic; copy-paste into any React Native app.
 */

export type ColorScheme = 'light' | 'dark';

export type ColorTokens = {
  paper: string;
  surface: string;
  text: string;
  textSecondary: string;
  tint: string;
  icon: string;
  border: string;
  outline: string;
  tintMuted: string;
  tabIconDefault: string;
  tabIconSelected: string;
  destructive: string;
  success: string;
  warning: string;
  info: string;
  disabled: string;
  /** Primary brand gradient (e.g. space cards). */
  gradientPrimaryStart: string;
  gradientPrimaryEnd: string;
};

/** Warm paper/surfaces; violet accent and candy-like semantic hues; purple→pink gradients. */
export const defaultColors: Record<ColorScheme, ColorTokens> = {
  light: {
    paper: '#FFFBF7',
    surface: '#F5F0FF',
    text: '#1E1B4B',
    textSecondary: '#64748B',
    tint: '#7C3AED',
    icon: '#64748B',
    border: '#E9E4F5',
    outline: '#D4C8F0',
    tintMuted: 'rgba(124, 58, 237, 0.16)',
    tabIconDefault: '#A8A3B8',
    tabIconSelected: '#7C3AED',
    destructive: '#F43F5E',
    success: '#22C55E',
    warning: '#F59E0B',
    info: '#06B6D4',
    disabled: '#D1D5DB',
    gradientPrimaryStart: '#A855F7',
    gradientPrimaryEnd: '#EC4899',
  },
  dark: {
    paper: '#0F0D14',
    surface: '#1A1625',
    text: '#FAF5FF',
    textSecondary: '#A8A3B8',
    tint: '#C084FC',
    icon: '#A8A3B8',
    border: '#3B3550',
    outline: '#4C4468',
    tintMuted: 'rgba(192, 132, 252, 0.22)',
    tabIconDefault: '#6B6578',
    tabIconSelected: '#C084FC',
    destructive: '#FB7185',
    success: '#4ADE80',
    warning: '#FBBF24',
    info: '#22D3EE',
    disabled: '#52525B',
    gradientPrimaryStart: '#7E22CE',
    gradientPrimaryEnd: '#DB2777',
  },
};

export type ColorTokenName = keyof ColorTokens;
