/// <reference path="./fontsource-nunito.d.ts" />

import { Nunito_400Regular, useFonts } from '@expo-google-fonts/nunito';
import type { FontStacks } from '@pkgs/ui';
import { type ReactNode, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';

import { AppFontsContext } from './fonts-context';
import { useLocalPaintLatch } from './local-paint-latch';

/** Nuclear overhaul: one weight everywhere (400). */
const nunitoFontStacks: Partial<FontStacks> = {
  sans: String('Nunito_400Regular'),
  sansSemibold: String('Nunito_400Regular'),
  rounded: String('Nunito_400Regular'),
};

function WebFontsBootstrap({ children }: { children: ReactNode }): ReactNode {
  const { markFontsReady } = useLocalPaintLatch();
  useEffect(() => {
    void import('@fontsource/nunito/400.css').finally(() => {
      markFontsReady();
    });
  }, [markFontsReady]);

  const value = useMemo(
    () => ({
      fontsLoaded: true,
      fontError: null as Error | null,
      fontStacks: {
        sans: 'Nunito, system-ui, sans-serif',
        sansSemibold: 'Nunito, system-ui, sans-serif',
        rounded: 'Nunito, system-ui, sans-serif',
      } satisfies Partial<FontStacks>,
    }),
    []
  );

  return (
    <AppFontsContext.Provider value={value}>
      {children}
    </AppFontsContext.Provider>
  );
}

function NativeFontsBootstrap({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
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

export function AppFontsProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  if (Platform.OS === 'web') {
    return <WebFontsBootstrap>{children}</WebFontsBootstrap>;
  }
  return <NativeFontsBootstrap>{children}</NativeFontsBootstrap>;
}
