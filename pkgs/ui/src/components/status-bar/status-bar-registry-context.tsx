import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import type { RegisteredStatusBarItem, StatusBarItemId } from './types';
import { compareStatusBarItems, isStatusBarItemVisible } from './types';

export type StatusBarRegistryProviderProps = {
  children: ReactNode;
};

type StoredEntry = {
  item: RegisteredStatusBarItem;
  registrationId: string;
};

export type StatusBarRegistryContextValue = {
  items: RegisteredStatusBarItem[];
  upsert: (item: RegisteredStatusBarItem, registrationId: string) => void;
  remove: (id: StatusBarItemId, registrationId: string) => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const StatusBarRegistryContext =
  createContext<StatusBarRegistryContextValue | null>(null);

/** Exported for {@link StatusBarRegistryPortalBridge} portal re-provide. */
export { StatusBarRegistryContext };

/**
 * Registry backed by React state (not an external store). Child
 * `RegisterStatusBarItem` layout upserts call `setState` here so the host
 * always re-renders with the current item list — avoiding the
 * storeVersion/itemCount desync seen with a mutable store + useMemo.
 */
export function StatusBarRegistryProvider({
  children,
}: StatusBarRegistryProviderProps) {
  const [entries, setEntries] = useState(() => new Map<string, StoredEntry>());
  const [isOpen, setIsOpen] = useState(false);

  const upsert = useCallback(
    (item: RegisteredStatusBarItem, registrationId: string) => {
      setEntries((prev) => {
        const next = new Map(prev);
        next.set(item.id, { item, registrationId });
        return next;
      });
    },
    []
  );

  const remove = useCallback((id: StatusBarItemId, registrationId: string) => {
    setEntries((prev) => {
      const cur = prev.get(id);
      if (cur === undefined || cur.registrationId !== registrationId) {
        return prev;
      }
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);
  const close = useCallback(() => {
    setIsOpen(false);
  }, []);
  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const items = useMemo(
    () =>
      [...entries.values()]
        .map((s) => s.item)
        .filter(isStatusBarItemVisible)
        .sort(compareStatusBarItems),
    [entries]
  );

  const value = useMemo(
    (): StatusBarRegistryContextValue => ({
      items,
      upsert,
      remove,
      isOpen,
      open,
      close,
      toggle,
    }),
    [items, upsert, remove, isOpen, open, close, toggle]
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
