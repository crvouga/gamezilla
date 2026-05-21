import { AppThemeRoot } from '@gamezilla/ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReactNode } from 'react';

import { useAppFonts } from './fonts-context';

export function AppThemeProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { fontsLoaded, fontStacks } = useAppFonts();

  return (
    <AppThemeRoot
      storage={AsyncStorage}
      {...(fontsLoaded ? { fonts: fontStacks } : {})}
    >
      {children}
    </AppThemeRoot>
  );
}
