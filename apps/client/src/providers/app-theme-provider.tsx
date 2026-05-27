import { AppThemeRoot } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { useAppFonts } from './fonts-context';

export function AppThemeProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { fontsLoaded, fontStacks } = useAppFonts();

  return (
    <AppThemeRoot {...(fontsLoaded ? { fonts: fontStacks } : {})}>
      {children}
    </AppThemeRoot>
  );
}
