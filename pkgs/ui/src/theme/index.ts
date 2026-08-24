/**
 * App-agnostic theme system.
 * Copy-paste src/@shared/theme into any React Native app.
 *
 * Usage:
 *   <Box sx={{ px: 2, py: 1, background: 'surface' }} />
 */

export { AppStatusBar, type AppStatusBarProps } from './app-status-bar';
export { AppThemeRoot, type AppThemeRootProps } from './app-theme-root';
export {
  BREAKPOINT_MIN_DESKTOP,
  BREAKPOINT_MIN_TABLET,
  type BreakpointName,
  getBreakpoint,
} from './breakpoints';
export {
  bestOnColor,
  COLOR_PALETTE as defaultColors,
  type ColorScheme,
  type ColorTokens,
  type CssRgb8,
  contrastRatio,
  ON_DARK,
  ON_LIGHT,
  type OnColorSet,
  parseColor,
  relativeLuminance,
} from './colors';
export { type FontStacks, fonts } from './fonts';
export {
  MODAL_CONTENT_MARGIN_STEP,
  MODAL_WIDTH_PX,
  type ModalSize,
  resolveModalLayoutMaxHeight,
  resolveModalLayoutWidth,
} from './modal-size';
export {
  type DurationKey,
  duration,
  type EasingKey,
  easing,
  type Motion,
  motion,
} from './motion';
export * from './navigation';
export {
  type AppNavigationTheme,
  reactNavigationThemeFromTokens,
} from './navigation-theme';
export { NavigationThemeProvider } from './navigation-theme-provider';
export {
  OnColorProvider,
  type OnColorProviderProps,
  OnColorReset,
  useOnColor,
} from './on-color-context';
export {
  type BorderRadiusKey,
  borderRadius,
  type ElevationLevel,
  type ElevationStyle,
  fontSize,
  lineHeight,
  makeElevation,
  spacing,
} from './scale';
export {
  createSx,
  flattenSx,
  type ResolvedRnStyle,
  type SxInput,
  type SxProps,
} from './sx';
export type {
  SxAlign,
  SxCompileOptions,
  SxFlexDirection,
  SxJustify,
  SxRadius,
} from './sx-props';
export { resolveColor } from './sx-resolve';
export { sxToCss } from './sx-to-css';
export {
  defaultTextCasing,
  type TextCasing,
  textCasingToStyle,
} from './text-casing';
export type { Theme, ThemeLayout, ThemeProviderProps } from './theme-context';
export { ThemeProvider, useTheme } from './theme-context';
export {
  type ThemePreference,
  ThemePreferenceProvider,
  type ThemePreferenceProviderProps,
  useThemePreference,
} from './theme-preference';
export {
  type ActionBarChromeSpec,
  getActionBarChrome,
  getTopBarContentHeight,
  TOP_BAR_CONTENT_HEIGHT_MOBILE,
  useActionBarChrome,
} from './use-action-bar-chrome';
export { useBreakpoint } from './use-breakpoint';
export {
  type HostStyle,
  type HostSx,
  toRnHostStyle,
  useHostSx,
  withPointerEvents,
} from './use-host-sx';
export { useHoverCapable } from './use-hover-capable';
export { WebScrollbarTheme } from './web-scrollbar-theme';
