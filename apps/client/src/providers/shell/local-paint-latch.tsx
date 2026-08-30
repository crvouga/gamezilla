import { preloadChessBoardCanvas } from '@pkgs/chess-board/chess-board-canvas-runtime';
import { hideSplash } from '@pkgs/ui';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type LocalPaintLatchValue = {
  readonly markFontsReady: () => void;
  readonly markEngineReady: () => void;
  /** True when fonts, local engine, and Skia/chess canvas are ready. */
  readonly bootReady: boolean;
};

const LocalPaintLatchContext = createContext<LocalPaintLatchValue | null>(null);

/**
 * Holds the native splash until fonts, the identity-scoped local SQLite
 * engine, and eagerly warmed Skia/chess canvas assets are ready. Never waits
 * on network first-sync.
 */
export function LocalPaintLatchProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [fontsReady, setFontsReady] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);

  const markFontsReady = useCallback(() => {
    setFontsReady(true);
  }, []);
  const markEngineReady = useCallback(() => {
    setEngineReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void preloadChessBoardCanvas()
      .catch(() => {
        // Still release the gate — chess bootstrap remains a safety net.
      })
      .finally(() => {
        if (!cancelled) setAssetsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const bootReady = fontsReady && engineReady && assetsReady;

  useEffect(() => {
    if (!bootReady) return;
    void hideSplash();
  }, [bootReady]);

  const value = useMemo(
    (): LocalPaintLatchValue => ({
      markFontsReady,
      markEngineReady,
      bootReady,
    }),
    [markFontsReady, markEngineReady, bootReady]
  );

  return (
    <LocalPaintLatchContext.Provider value={value}>
      {children}
    </LocalPaintLatchContext.Provider>
  );
}

export function useLocalPaintLatch(): LocalPaintLatchValue {
  const value = useContext(LocalPaintLatchContext);
  if (value === null) {
    throw new Error(
      'useLocalPaintLatch: missing LocalPaintLatchProvider — wrap with AppProviders'
    );
  }
  return value;
}
