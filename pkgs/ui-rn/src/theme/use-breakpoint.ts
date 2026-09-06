import { useWindowDimensions } from 'react-native';

import { type BreakpointName, getBreakpoint } from './breakpoints';

/**
 * Current layout bucket from window width. Prefer `useTheme().breakpoint` when inside `ThemeProvider`.
 */
export function useBreakpoint(): BreakpointName {
  const { width } = useWindowDimensions();
  return getBreakpoint(width);
}
