/**
 * App-agnostic theme system.
 * Copy-paste src/@shared/theme into any React Native app.
 *
 * Usage:
 *   const theme = useTheme();
 *   <View style={theme.sx({ px: 2, py: 1, background: "surface" })} />
 */

export { AppStatusBar, type AppStatusBarProps } from './app-status-bar';
export { AppThemeRoot, type AppThemeRootProps } from './app-theme-root';
export {
  BREAKPOINT_MIN_DESKTOP,
  BREAKPOINT_MIN_TABLET,
  getBreakpoint,
  type BreakpointName,
} from './breakpoints';
export {
  COLOR_PALETTE as defaultColors,
  type ColorScheme,
  type ColorTokens,
} from './colors';
export { fonts, type FontStacks } from './fonts';
export * from './navigation';
export {
  reactNavigationThemeFromTokens,
  type AppNavigationTheme,
} from './navigation-theme';
export { NavigationThemeProvider } from './navigation-theme-provider';
export {
  borderRadius,
  elevation,
  fontSize,
  lineHeight,
  spacing,
  type BorderRadiusKey,
  type ElevationLevel,
} from './scale';
export { createSx, type SxProps } from './sx';
export {
  defaultTextCasing,
  textCasingToStyle,
  type TextCasing,
} from './text-casing';
export { ThemeProvider, useTheme } from './theme-context';
export type { Theme, ThemeLayout, ThemeProviderProps } from './theme-context';
export {
  ThemePreferenceProvider,
  useThemePreference,
  type ThemePreference,
  type ThemePreferenceProviderProps,
  type ThemePreferenceStorage,
} from './theme-preference';
export { useBreakpoint } from './use-breakpoint';
export { WebScrollbarTheme } from './web-scrollbar-theme';
