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
 * Neutrals are fuchsia-only: pale fuchsia surfaces / near-black fuchsia bases, deep fuchsia
 * body text or light fuchsia-50 tints on dark. Borders are soft tints of the same hue.
 * Semantic tokens (success / warning / info / destructive) stay non-fuchsia for clarity.
 */
export const defaultColors: Record<ColorScheme, ColorTokens> = {
  light: {
    paper: '#fdf4ff',
    surface: '#fae8ff',
    text: '#4a044e',
    textSecondary: '#86198f',
    tint: '#c026d3',
    icon: '#a21caf',
    border: 'rgba(74, 4, 78, 0.06)',
    outline: 'rgba(74, 4, 78, 0.12)',
    tintMuted: 'rgba(192, 38, 211, 0.18)',
    tabIconDefault: 'rgba(134, 25, 143, 0.35)',
    tabIconSelected: '#c026d3',
    destructive: '#E11D48',
    success: '#84CC16',
    warning: '#FACC15',
    info: '#22D3EE',
    disabled: '#e879f9',
    gradientPrimaryStart: '#c026d3',
    gradientPrimaryEnd: '#a21caf',
  },
  dark: {
    paper: '#0f0610',
    surface: '#1a0c1c',
    text: '#fdf4ff',
    textSecondary: '#f0abfc',
    tint: '#e879f9',
    icon: '#f5d0fe',
    border: 'rgba(253, 244, 255, 0.07)',
    outline: 'rgba(240, 171, 252, 0.16)',
    tintMuted: 'rgba(232, 121, 249, 0.26)',
    tabIconDefault: 'rgba(240, 171, 252, 0.4)',
    tabIconSelected: '#f5d0fe',
    destructive: '#FB7185',
    success: '#BEF264',
    warning: '#FDE047',
    info: '#67E8F9',
    disabled: '#86198f',
    gradientPrimaryStart: '#a21caf',
    gradientPrimaryEnd: '#86198f',
  },
};

export type ColorTokenName = keyof ColorTokens;
