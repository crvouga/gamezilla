import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

export type SessionTokenModel = {
  getSessionToken(): string | null;
  setSessionToken(token: string | null): void;
  subscribe(listener: () => void): () => void;
};

const Ctx = createContext<SessionTokenModel | null>(null);

export function SessionTokenProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const tokenRef = useRef<string | null>(null);
  const listenersRef = useRef(new Set<() => void>());

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const notify = useCallback(() => {
    for (const l of listenersRef.current) {
      l();
    }
  }, []);

  const getSessionToken = useCallback(() => tokenRef.current, []);

  const setSessionToken = useCallback(
    (token: string | null) => {
      tokenRef.current = token;
      notify();
    },
    [notify]
  );

  const value = useMemo<SessionTokenModel>(
    () => ({
      getSessionToken,
      setSessionToken,
      subscribe,
    }),
    [getSessionToken, setSessionToken, subscribe]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSessionTokenModel(): SessionTokenModel {
  const v = useContext(Ctx);
  if (v === null) {
    throw new Error(
      'useSessionTokenModel: SessionTokenProvider missing — wrap with AppProviders'
    );
  }
  return v;
}

export function useSessionToken(): string | null {
  const m = useSessionTokenModel();
  return useSyncExternalStore(
    m.subscribe,
    () => m.getSessionToken(),
    () => m.getSessionToken()
  );
}
