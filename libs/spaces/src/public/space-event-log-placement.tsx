/**
 * Wide active-space body may host an optional side rail for game chrome.
 * Games inject extras into the rail via {@link SpaceSideRailExtras}.
 */

import {
  type Accessor,
  createContext,
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  useContext,
} from 'solid-js';

type SpaceSideRailValue = {
  readonly extras: Accessor<JSX.Element | null>;
  readonly setExtras: (node: JSX.Element | null) => void;
};

const SpaceSideRailContext = createContext<SpaceSideRailValue | null>(null);

const NO_EXTRAS: Accessor<JSX.Element | null> = () => null;

export type SpaceSideRailProviderProps = {
  readonly children: JSX.Element;
};

export function SpaceSideRailProvider(
  props: SpaceSideRailProviderProps
): JSX.Element {
  const [extras, setExtrasSignal] = createSignal<JSX.Element | null>(null);
  const setExtras = (node: JSX.Element | null): void => {
    setExtrasSignal(() => node);
  };
  const value: SpaceSideRailValue = { extras, setExtras };
  return (
    <SpaceSideRailContext.Provider value={value}>
      {props.children}
    </SpaceSideRailContext.Provider>
  );
}

export function useSpaceSideRailExtras(): Accessor<JSX.Element | null> {
  return useContext(SpaceSideRailContext)?.extras ?? NO_EXTRAS;
}

/**
 * Publish nodes into the wide side rail. Cleared on unmount. No-op outside
 * {@link SpaceSideRailProvider} / compact layouts.
 */
export function SpaceSideRailExtras(props: {
  readonly children: JSX.Element;
}): null {
  const ctx = useContext(SpaceSideRailContext);

  createEffect(() => {
    if (ctx === null) return;
    ctx.setExtras(props.children);
    onCleanup(() => ctx.setExtras(null));
  });

  return null;
}
