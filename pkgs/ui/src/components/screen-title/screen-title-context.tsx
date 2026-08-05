/**
 * Shared title label + TopBar visibility for {@link ScreenBase} `largeTitle`.
 */

import { createContext, useContext, useState, type ReactNode } from 'react';

import { shouldShowTopBarTitle } from './screen-title-reveal';

export type ScreenTitleContextValue = {
  title: ReactNode;
  showInTopBar: boolean;
  setScrollY: (y: number) => void;
};

const ScreenTitleContext = createContext<ScreenTitleContextValue | null>(null);

export type ScreenTitleProviderProps = {
  title: ReactNode;
  children: ReactNode;
};

export function ScreenTitleProvider({
  title,
  children,
}: ScreenTitleProviderProps): ReactNode {
  const [showInTopBar, setShowInTopBar] = useState(false);

  const value: ScreenTitleContextValue = {
    title,
    showInTopBar,
    setScrollY: (y: number) => {
      const next = shouldShowTopBarTitle(y);
      setShowInTopBar((prev) => (prev === next ? prev : next));
    },
  };

  return (
    <ScreenTitleContext.Provider value={value}>
      {children}
    </ScreenTitleContext.Provider>
  );
}

export function useScreenTitleContext(): ScreenTitleContextValue | null {
  return useContext(ScreenTitleContext);
}

export function useRequiredScreenTitleContext(): ScreenTitleContextValue {
  const ctx = useScreenTitleContext();
  if (ctx === null) {
    throw new Error(
      'ScreenLargeTitle / useScreenTitleScroll require ScreenTitleProvider (ScreenBase largeTitle)'
    );
  }
  return ctx;
}
