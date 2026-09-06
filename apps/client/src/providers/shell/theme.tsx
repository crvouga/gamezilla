import { AppThemeRoot } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';

import { useAppFonts } from './fonts-context';

/**
 * Always apply Nunito stacks (do not wait for `fontsLoaded`).
 *
 * Gating on load left Platform iOS `ui-rounded` on navigation titles during
 * remounts / brief unload windows. Sim report HTML then falls back to Times in
 * browsers. Splash covers native until fonts and the local engine are ready.
 */
export function AppTheme({ children }: { children: ReactNode }): ReactNode {
  const { fontStacks } = useAppFonts();

  return <AppThemeRoot fonts={fontStacks}>{children}</AppThemeRoot>;
}
