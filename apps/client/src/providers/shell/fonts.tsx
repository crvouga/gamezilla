import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import type { FontStacks } from '@pkgs/ui';
import { type ReactNode, useEffect, useMemo } from 'react';

import { AppFontsContext } from './fonts-context';
import { useLocalPaintLatch } from './local-paint-latch';

/**
 * Expo postscript names — `useFonts` registers these on native and injects
 * matching `@font-face` rules on web. Do not load CSS via `@fontsource`:
 * Metro does not inject a dynamic `import('*.css')`, so the UI fell back
 * to the system sans (sharp terminals, not Nunito).
 */
const nunitoFontStacks: Partial<FontStacks> = {
  sans: 'Nunito_400Regular',
  sansSemibold: 'Nunito_600SemiBold',
  rounded: 'Nunito_400Regular',
};

export function AppFontsProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const { markFontsReady } = useLocalPaintLatch();

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document
        .querySelectorAll(
          'link[href*="/files/nunito"], link[href*="fontsource"]'
        )
        .forEach((node) => {
          node.remove();
        });
    }
    if (fontsLoaded || fontError !== null) {
      markFontsReady();
    }
  }, [fontsLoaded, fontError, markFontsReady]);

  const value = useMemo(
    () => ({
      fontsLoaded,
      fontError: fontError as Error | null,
      fontStacks: nunitoFontStacks,
    }),
    [fontsLoaded, fontError]
  );

  return (
    <AppFontsContext.Provider value={value}>
      {children}
    </AppFontsContext.Provider>
  );
}
