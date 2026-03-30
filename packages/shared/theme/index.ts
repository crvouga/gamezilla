/**
 * App-agnostic theme system.
 * Copy-paste src/@shared/theme into any React Native app.
 *
 * Usage:
 *   const theme = useTheme();
 *   <View style={theme.sx({ px: 2, py: 1, background: "paper" })} />
 */

export { ThemeProvider, useTheme } from './theme-context';
export type { Theme, ThemeProviderProps } from './theme-context';
export { defaultColors, type ColorScheme, type ColorTokens } from './colors';
export { fonts } from './fonts';
export { createSx, type SxProps } from './sx';
export { spacing, fontSize, lineHeight } from './scale';
