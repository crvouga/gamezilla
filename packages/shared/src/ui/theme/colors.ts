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
};

/** Neutral paper/surface; sky-blue accent for controls and links. */
export const defaultColors: Record<ColorScheme, ColorTokens> = {
  light: {
    paper: '#FAFAFA',
    surface: '#F4F4F5',
    text: '#18181B',
    textSecondary: '#71717A',
    tint: '#2563EB',
    icon: '#71717A',
    border: '#E4E4E7',
    outline: '#D4D4D8',
    tintMuted: 'rgba(37, 99, 235, 0.18)',
    tabIconDefault: '#A1A1AA',
    tabIconSelected: '#2563EB',
    destructive: '#E11D48',
    success: '#16A34A',
    warning: '#EA580C',
    info: '#0EA5E9',
    disabled: '#D4D4D8',
  },
  dark: {
    paper: '#0A0A0A',
    surface: '#171717',
    text: '#FAFAFA',
    textSecondary: '#A1A1AA',
    tint: '#60A5FA',
    icon: '#A1A1AA',
    border: '#3F3F46',
    outline: '#52525B',
    tintMuted: 'rgba(96, 165, 250, 0.22)',
    tabIconDefault: '#71717A',
    tabIconSelected: '#60A5FA',
    destructive: '#FB7185',
    success: '#4ADE80',
    warning: '#FBBF24',
    info: '#38BDF8',
    disabled: '#52525B',
  },
};

export type ColorTokenName = keyof ColorTokens;
