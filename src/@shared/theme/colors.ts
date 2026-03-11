/**
 * Prebuilt light/dark color palettes.
 * App-agnostic; copy-paste into any React Native app.
 */

export type ColorScheme = 'light' | 'dark';

export type ColorTokens = {
  paper: string;
  text: string;
  tint: string;
  icon: string;
  border: string;
  tintMuted: string;
  tabIconDefault: string;
  tabIconSelected: string;
  destructive: string;
};

export const defaultColors: Record<ColorScheme, ColorTokens> = {
  light: {
    paper: '#fff',
    text: '#11181C',
    tint: '#0a7ea4',
    icon: '#687076',
    border: '#e5e5e5',
    tintMuted: 'rgba(10, 126, 164, 0.2)',
    tabIconDefault: '#687076',
    tabIconSelected: '#0a7ea4',
    destructive: '#dc3545',
  },
  dark: {
    paper: '#151718',
    text: '#ECEDEE',
    tint: '#fff',
    icon: '#9BA1A6',
    border: '#333',
    tintMuted: 'rgba(255, 255, 255, 0.15)',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#fff',
    destructive: '#e74c3c',
  },
};

export type ColorTokenName = keyof ColorTokens;
