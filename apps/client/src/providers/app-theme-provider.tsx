import { AppThemeRoot } from '@pkgs/ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReactNode } from 'react';

import { useAppFonts } from './fonts-context';

// AsyncStorage key for the user's color-scheme preference. Pinned explicitly
// so existing installs don't lose their saved choice when @pkgs/ui's neutral
// default key changes.
// eslint-disable-next-line lingui/no-unlocalized-strings -- AsyncStorage key, not user-facing.
const COLOR_SCHEME_STORAGE_KEY = '@gamezilla/color-scheme-preference';

export function AppThemeProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { fontsLoaded, fontStacks } = useAppFonts();

  return (
    <AppThemeRoot
      storage={AsyncStorage}
      storageKey={COLOR_SCHEME_STORAGE_KEY}
      {...(fontsLoaded ? { fonts: fontStacks } : {})}
    >
      {children}
    </AppThemeRoot>
  );
}
