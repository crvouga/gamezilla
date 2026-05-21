import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { hideSplash } from '@gamezilla/ui';
import type { FontStacks } from '@gamezilla/ui';
import { useEffect, useMemo, type ReactNode } from 'react';

import { AppFontsContext } from './fonts-context';

const nunitoFontStacks: Partial<FontStacks> = {
  sans: String('Nunito_400Regular'),
  sansSemibold: String('Nunito_600SemiBold'),
  rounded: String('Nunito_700Bold'),
};

export function FontsProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError !== null) {
      void hideSplash();
    }
  }, [fontsLoaded, fontError]);

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
