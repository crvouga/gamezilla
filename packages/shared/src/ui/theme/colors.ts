/**
 * Prebuilt light/dark color palettes.
 * App-agnostic; copy-paste into any React Native app.
 */

export type ColorScheme = 'light' | 'dark';

export type ColorTokens = {
  surface: string;
  background: string;
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
 * Neutrals are true grays: pale gray surfaces / near-black bases, deep gray
 * body text or light gray-50 tints on dark. Borders are soft tints of black/white.
 * The primary tint stays blue for brand recognition.
 * Semantic tokens (success / warning / info / destructive) stay distinct for clarity.
 */
export const defaultColors: Record<ColorScheme, ColorTokens> = {
  light: {
    surface: '#f4f4f5',
    background: '#ffffff',
    text: '#09090b',
    textSecondary: '#52525b',
    tint: '#2563eb',
    icon: '#3f3f46',
    border: 'rgba(9, 9, 11, 0.06)',
    outline: 'rgba(9, 9, 11, 0.12)',
    tintMuted: 'rgba(37, 99, 235, 0.18)',
    tabIconDefault: 'rgba(82, 82, 91, 0.5)',
    tabIconSelected: '#2563eb',
    destructive: '#E11D48',
    success: '#84CC16',
    warning: '#FACC15',
    info: '#22D3EE',
    disabled: '#d4d4d8',
    gradientPrimaryStart: '#2563eb',
    gradientPrimaryEnd: '#1d4ed8',
  },
  dark: {
    surface: '#18181b',
    background: '#000000',
    text: '#fafafa',
    textSecondary: '#a1a1aa',
    tint: '#60a5fa',
    icon: '#d4d4d8',
    border: 'rgba(250, 250, 250, 0.07)',
    outline: 'rgba(250, 250, 250, 0.14)',
    tintMuted: 'rgba(96, 165, 250, 0.26)',
    tabIconDefault: 'rgba(161, 161, 170, 0.55)',
    tabIconSelected: '#fafafa',
    destructive: '#FB7185',
    success: '#BEF264',
    warning: '#FDE047',
    info: '#67E8F9',
    disabled: '#3f3f46',
    gradientPrimaryStart: '#2563eb',
    gradientPrimaryEnd: '#1d4ed8',
  },
};

export type ColorTokenName = keyof ColorTokens;
