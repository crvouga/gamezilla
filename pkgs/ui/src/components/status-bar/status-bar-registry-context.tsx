import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import { StatusBarRegistryStore } from './status-bar-registry-store';

export type StatusBarRegistryProviderProps = {
  children: ReactNode;
};

export type StatusBarRegistryContextValue = {
  store: StatusBarRegistryStore;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const StatusBarRegistryContext =
  createContext<StatusBarRegistryContextValue | null>(null);

/** Exported for {@link StatusBarRegistryPortalBridge} portal re-provide. */
export { StatusBarRegistryContext };

function useStableStore(): StatusBarRegistryStore {
  const ref = useRef<StatusBarRegistryStore | null>(null);
  if (ref.current === null) ref.current = new StatusBarRegistryStore();
  return ref.current;
}

export function StatusBarRegistryProvider({
  children,
}: StatusBarRegistryProviderProps) {
  const store = useStableStore();
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);
  const close = useCallback(() => {
    setIsOpen(false);
  }, []);
  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const value = useMemo(
    (): StatusBarRegistryContextValue => ({
      store,
      isOpen,
      open,
      close,
      toggle,
    }),
    [store, isOpen, open, close, toggle]
  );

  return (
    <StatusBarRegistryContext.Provider value={value}>
      {children}
    </StatusBarRegistryContext.Provider>
  );
}

export function useStatusBarRegistry(): StatusBarRegistryContextValue {
  const ctx = useContext(StatusBarRegistryContext);
  if (ctx === null) {
    throw new Error(
      'useStatusBarRegistry must be used within StatusBarRegistryProvider'
    );
  }
  return ctx;
}

export function useStatusBarRegistryOptional(): StatusBarRegistryContextValue | null {
  return useContext(StatusBarRegistryContext);
}
