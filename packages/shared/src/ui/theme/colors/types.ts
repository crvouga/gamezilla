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

export type ColorTokenName = keyof ColorTokens;

export type Colors = Record<ColorScheme, ColorTokens>;
