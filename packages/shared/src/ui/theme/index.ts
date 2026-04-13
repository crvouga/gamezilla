/**
 * App-agnostic theme system.
 * Copy-paste src/@shared/theme into any React Native app.
 *
 * Usage:
 *   const theme = useTheme();
 *   <View style={theme.sx({ px: 2, py: 1, background: "paper" })} />
 */

export { ThemeProvider, useTheme } from './theme-context';
export type {
  Theme,
  ThemeLayout,
  ThemeProviderProps,
} from './theme-context';
export { defaultColors, type ColorScheme, type ColorTokens } from './colors';
export { fonts, type FontStacks } from './fonts';
export { createSx, type SxProps } from './sx';
export {
  spacing,
  fontSize,
  lineHeight,
  borderRadius,
  elevation,
  type BorderRadiusKey,
  type ElevationLevel,
} from './scale';
