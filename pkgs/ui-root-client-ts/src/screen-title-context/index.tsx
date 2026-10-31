/** @jsxImportSource solid-js */

import { shouldShowTopBarTitle } from '@pkgs/ui-root-shared-ts/screen-title-reveal';
import {
  type Accessor,
  createContext,
  createSignal,
  type JSX,
  useContext,
} from 'solid-js';

export type ScreenTitleContextValue = {
  title: Accessor<JSX.Element>;
  showInTopBar: Accessor<boolean>;
  setScrollY: (y: number) => void;
};

const ScreenTitleContext = createContext<ScreenTitleContextValue | null>(null);

export type ScreenTitleProviderProps = {
  title: JSX.Element;
  children: JSX.Element;
};

export function ScreenTitleProvider(
  props: ScreenTitleProviderProps
): JSX.Element {
  const [showInTopBar, setShowInTopBar] = createSignal(false);
  const value: ScreenTitleContextValue = {
    title: () => props.title,
    showInTopBar,
    setScrollY: (y) => setShowInTopBar(shouldShowTopBarTitle(y)),
  };
  return (
    <ScreenTitleContext.Provider value={value}>
      {props.children}
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
