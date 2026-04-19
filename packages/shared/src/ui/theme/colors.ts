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
  /** Subtle brand gradient (two close, dark stops for light text on top). */
  gradientPrimaryStart: string;
  gradientPrimaryEnd: string;
};

/**
 * Neutrals are purple-only: pale purple surfaces / near-black purple bases, deep purple
 * body text or light purple-50 tints on dark. Borders are soft tints of the same hue.
 * Semantic tokens (success / warning / info / destructive) stay non-purple for clarity.
 */
export const defaultColors: Record<ColorScheme, ColorTokens> = {
  light: {
    paper: '#faf5ff',
    surface: '#f3e8ff',
    text: '#3b0764',
    textSecondary: '#6b21a8',
    tint: '#9333ea',
    icon: '#7e22ce',
    border: 'rgba(59, 7, 100, 0.06)',
    outline: 'rgba(59, 7, 100, 0.12)',
    tintMuted: 'rgba(147, 51, 234, 0.18)',
    tabIconDefault: 'rgba(107, 33, 168, 0.35)',
    tabIconSelected: '#9333ea',
    destructive: '#E11D48',
    success: '#84CC16',
    warning: '#FACC15',
    info: '#22D3EE',
    disabled: '#c084fc',
    gradientPrimaryStart: '#9333ea',
    gradientPrimaryEnd: '#7e22ce',
  },
  dark: {
    paper: '#0c0610',
    surface: '#170c1c',
    text: '#faf5ff',
    textSecondary: '#d8b4fe',
    tint: '#c084fc',
    icon: '#e9d5ff',
    border: 'rgba(250, 245, 255, 0.07)',
    outline: 'rgba(216, 180, 254, 0.16)',
    tintMuted: 'rgba(192, 132, 252, 0.26)',
    tabIconDefault: 'rgba(216, 180, 254, 0.4)',
    tabIconSelected: '#e9d5ff',
    destructive: '#FB7185',
    success: '#BEF264',
    warning: '#FDE047',
    info: '#67E8F9',
    disabled: '#6b21a8',
    gradientPrimaryStart: '#7e22ce',
    gradientPrimaryEnd: '#6b21a8',
  },
};

export type ColorTokenName = keyof ColorTokens;
