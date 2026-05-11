import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

export type AccountIdModel = {
  getAccountId(): string | null;
  setAccountId(id: string | null): void;
  subscribe(listener: () => void): () => void;
};

const Ctx = createContext<AccountIdModel | null>(null);

export function AccountIdProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const idRef = useRef<string | null>(null);
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

  const getAccountId = useCallback(() => idRef.current, []);

  const setAccountId = useCallback(
    (id: string | null) => {
      idRef.current = id;
      notify();
    },
    [notify]
  );

  const value = useMemo<AccountIdModel>(
    () => ({
      getAccountId,
      setAccountId,
      subscribe,
    }),
    [getAccountId, setAccountId, subscribe]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccountIdModel(): AccountIdModel {
  const v = useContext(Ctx);
  if (v === null) {
    throw new Error(
      'useAccountIdModel: AccountIdProvider missing — wrap with AppProviders'
    );
  }
  return v;
}

export function useAccountId(): string | null {
  const m = useAccountIdModel();
  return useSyncExternalStore(
    m.subscribe,
    () => m.getAccountId(),
    () => m.getAccountId()
  );
}
