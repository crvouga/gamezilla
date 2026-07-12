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
  bestOnColor,
  contrastRatio,
  ON_DARK,
  ON_LIGHT,
  parseColor,
  relativeLuminance,
  type ColorScheme,
  type ColorTokens,
  type OnColorSet,
  type Rgb,
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
  makeElevation,
  spacing,
  type BorderRadiusKey,
  type ElevationLevel,
  type ElevationStyle,
} from './scale';
export {
  MODAL_CONTENT_MARGIN_STEP,
  MODAL_WIDTH_PX,
  resolveModalLayoutWidth,
  type ModalSize,
} from './modal-size';
export {
  duration,
  easing,
  motion,
  type DurationKey,
  type EasingKey,
  type Motion,
} from './motion';
export {
  OnColorProvider,
  OnColorReset,
  useOnColor,
  type OnColorProviderProps,
} from './on-color-context';
export { createSx, type SxProps } from './sx';
export {
  defaultTextCasing,
  textCasingToStyle,
  type TextCasing,
} from './text-casing';
export { ThemeProvider, useTheme } from './theme-context';
export type { Theme, ThemeLayout, ThemeProviderProps } from './theme-context';
export { useBreakpoint } from './use-breakpoint';
export {
  ThemePreferenceProvider,
  useThemePreference,
  type ThemePreference,
  type ThemePreferenceProviderProps,
} from './theme-preference';
export { WebScrollbarTheme } from './web-scrollbar-theme';
