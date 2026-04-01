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

export const defaultColors: Record<ColorScheme, ColorTokens> = {
  light: {
    paper: '#fff',
    surface: '#f5f5f5',
    text: '#11181C',
    textSecondary: '#687076',
    tint: '#0a7ea4',
    icon: '#687076',
    border: '#e5e5e5',
    outline: '#c4c4c4',
    tintMuted: 'rgba(10, 126, 164, 0.2)',
    tabIconDefault: '#687076',
    tabIconSelected: '#0a7ea4',
    destructive: '#dc3545',
    success: '#28a745',
    warning: '#f59e0b',
    info: '#0a7ea4',
    disabled: '#c4c4c4',
  },
  dark: {
    paper: '#151718',
    surface: '#1e2022',
    text: '#ECEDEE',
    textSecondary: '#9BA1A6',
    tint: '#fff',
    icon: '#9BA1A6',
    border: '#333',
    outline: '#555',
    tintMuted: 'rgba(255, 255, 255, 0.15)',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#fff',
    destructive: '#e74c3c',
    success: '#2ecc71',
    warning: '#f1c40f',
    info: '#3498db',
    disabled: '#555',
  },
};

export type ColorTokenName = keyof ColorTokens;
