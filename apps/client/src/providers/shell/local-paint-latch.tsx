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
};

const LocalPaintLatchContext = createContext<LocalPaintLatchValue | null>(null);

/**
 * Holds the native splash until fonts are loaded and the identity-scoped
 * local SQLite engine is mounted. Never waits on network first-sync.
 */
export function LocalPaintLatchProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [fontsReady, setFontsReady] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const markFontsReady = useCallback(() => {
    setFontsReady(true);
  }, []);
  const markEngineReady = useCallback(() => {
    setEngineReady(true);
  }, []);

  useEffect(() => {
    if (!fontsReady || !engineReady) return;
    void hideSplash();
  }, [fontsReady, engineReady]);

  const value = useMemo(
    (): LocalPaintLatchValue => ({ markFontsReady, markEngineReady }),
    [markFontsReady, markEngineReady]
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
