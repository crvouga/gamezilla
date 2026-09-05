/**
 * AppFrame chrome context: replaceable wide header + shared global trailing
 * (avatar menu) for any top bar.
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

/**
 * `null` — use AppFrame's default `header` prop.
 * `false` — hide the AppFrame header (caller paints chrome in-tree).
 * `ReactNode` — replace the default header.
 */
export type AppFrameHeaderOverride = ReactNode | false | null;

type AppFrameChromeContextValue = {
  readonly headerOverride: AppFrameHeaderOverride;
  readonly setHeaderOverride: (node: AppFrameHeaderOverride) => void;
  readonly globalTrailing: ReactNode | null;
};

const AppFrameChromeContext = createContext<AppFrameChromeContextValue | null>(
  null
);

export type AppFrameChromeProviderProps = {
  /** Always-visible trailing chrome (e.g. avatar global menu). */
  readonly globalTrailing?: ReactNode;
  readonly children: ReactNode;
};

export function AppFrameChromeProvider(
  props: AppFrameChromeProviderProps
): ReactNode {
  const { globalTrailing = null, children } = props;
  const [headerOverride, setHeaderOverrideState] =
    useState<AppFrameHeaderOverride>(null);
  const setHeaderOverride = useCallback((node: AppFrameHeaderOverride) => {
    setHeaderOverrideState(node);
  }, []);
  const value = useMemo(
    (): AppFrameChromeContextValue => ({
      headerOverride,
      setHeaderOverride,
      globalTrailing,
    }),
    [headerOverride, setHeaderOverride, globalTrailing]
  );
  return (
    <AppFrameChromeContext.Provider value={value}>
      {children}
    </AppFrameChromeContext.Provider>
  );
}

function useAppFrameChromeOptional(): AppFrameChromeContextValue | null {
  return useContext(AppFrameChromeContext);
}

/**
 * Replace or suppress the AppFrame wide header while mounted.
 * Pass `null` to restore the default; `false` to hide it.
 * No-op outside {@link AppFrameChromeProvider}.
 */
export function useSetAppFrameHeader(node: AppFrameHeaderOverride): void {
  const ctx = useAppFrameChromeOptional();
  const setHeaderOverride = ctx?.setHeaderOverride;
  useLayoutEffect(() => {
    if (setHeaderOverride === undefined) return;
    setHeaderOverride(node);
    return () => {
      setHeaderOverride(null);
    };
  }, [node, setHeaderOverride]);
}

/** Shared trailing chrome (avatar menu). Null when no provider. */
export function useAppFrameGlobalTrailing(): ReactNode | null {
  return useAppFrameChromeOptional()?.globalTrailing ?? null;
}

/** Effective wide header: override / suppress / default. */
export function useAppFrameHeader(defaultHeader: ReactNode): ReactNode {
  const override = useAppFrameChromeOptional()?.headerOverride ?? null;
  if (override === false) return null;
  if (override !== null) return override;
  return defaultHeader;
}
