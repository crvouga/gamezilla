/**
 * Status bar that follows the current theme (light content on dark backgrounds).
 */

import { StatusBar, type StatusBarStyle } from 'expo-status-bar';

import { useTheme } from './theme-context';

export type AppStatusBarProps = {
  /** When set, overrides theme-based style. */
  style?: StatusBarStyle;
};

export function AppStatusBar({ style }: AppStatusBarProps) {
  const theme = useTheme();
  const resolved =
    style ?? (theme.colorScheme === 'dark' ? 'light' : 'dark');
  return <StatusBar style={resolved} />;
}
