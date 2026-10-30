/** @jsxImportSource solid-js */

import {
  type Accessor,
  createContext,
  createSignal,
  type JSX,
  onCleanup,
  useContext,
} from 'solid-js';

export type AppFrameHeaderOverride = JSX.Element | false | null;

type AppFrameChromeContextValue = {
  readonly headerOverride: Accessor<AppFrameHeaderOverride>;
  readonly setHeaderOverride: (node: AppFrameHeaderOverride) => void;
  readonly globalTrailing: Accessor<JSX.Element | null>;
};

const AppFrameChromeContext = createContext<AppFrameChromeContextValue>();

export type AppFrameChromeProviderProps = {
  /** Always-visible trailing chrome (e.g. avatar global menu). */
  readonly globalTrailing?: JSX.Element | undefined;
  readonly children: JSX.Element;
};

/**
 * App-frame chrome registry: screens can override (or hide) the wide header
 * island for their lifetime; the shell reads the resolved header.
 */
export function AppFrameChromeProvider(
  props: AppFrameChromeProviderProps
): JSX.Element {
  const [headerOverride, setHeaderOverride] =
    createSignal<AppFrameHeaderOverride>(null);
  const value: AppFrameChromeContextValue = {
    headerOverride,
    setHeaderOverride: (node) => setHeaderOverride(() => node),
    globalTrailing: () => props.globalTrailing ?? null,
  };
  return (
    <AppFrameChromeContext.Provider value={value}>
      {props.children}
    </AppFrameChromeContext.Provider>
  );
}

/**
 * Register a header override for the lifetime of the calling component.
 * `false` hides the header; `null` restores the default.
 */
export function useSetAppFrameHeader(node: AppFrameHeaderOverride): void {
  const ctx = useContext(AppFrameChromeContext);
  if (ctx === undefined) return;
  ctx.setHeaderOverride(node);
  onCleanup(() => ctx.setHeaderOverride(null));
}

export function useAppFrameGlobalTrailing(): Accessor<JSX.Element | null> {
  const ctx = useContext(AppFrameChromeContext);
  return ctx?.globalTrailing ?? (() => null);
}

/** Resolved header: an override when registered, else `defaultHeader`. */
export function useAppFrameHeader(
  defaultHeader: () => JSX.Element
): Accessor<JSX.Element> {
  const ctx = useContext(AppFrameChromeContext);
  return () => {
    const override = ctx?.headerOverride() ?? null;
    if (override === false) return null;
    if (override !== null) return override;
    return defaultHeader();
  };
}
