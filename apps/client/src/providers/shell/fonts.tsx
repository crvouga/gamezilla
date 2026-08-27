import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  useFonts,
} from '@expo-google-fonts/nunito';
import type { FontStacks } from '@pkgs/ui';
import { type ReactNode, useEffect, useMemo } from 'react';

import { AppFontsContext } from './fonts-context';
import { useLocalPaintLatch } from './local-paint-latch';

const nunitoFontStacks: Partial<FontStacks> = {
  sans: String('Nunito_400Regular'),
  sansSemibold: String('Nunito_600SemiBold'),
  rounded: String('Nunito_700Bold'),
};

export function AppFontsProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });
  const { markFontsReady } = useLocalPaintLatch();

  useEffect(() => {
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
