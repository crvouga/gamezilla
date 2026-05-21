import type { FontStacks } from '@pkgs/ui';
import { createContext, useContext } from 'react';

export type AppFontsContextValue = {
  fontsLoaded: boolean;
  fontError: Error | null;
  fontStacks: Partial<FontStacks>;
};

export const AppFontsContext = createContext<AppFontsContextValue | null>(null);

export function useAppFonts(): AppFontsContextValue {
  const v = useContext(AppFontsContext);
  if (v === null) {
    throw new Error(
      'useAppFonts: missing FontsProvider — wrap with AppProviders'
    );
  }
  return v;
}
