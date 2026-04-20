import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { Platform } from 'react-native';

import type { ThemePreferenceStorage } from '../../theme';
import { CommandRegistryStore } from './command-registry-store';
import { HistoryStore } from './history-store';
import { matchesWebShortcut, type WebKeyboardEventLike } from './keyboard-shortcut';
import type { CommandId } from './types';
import { isCommandEnabled, isCommandVisible, normalizeShortcut } from './types';

const DEFAULT_OPEN_SHORTCUTS = ['mod+k', 'mod+shift+p'];
const DEFAULT_STORAGE_KEY = '@gamezilla/command-history';

export type CommandRegistryProviderProps = {
  children: ReactNode;
  storage?: ThemePreferenceStorage;
  storageKey?: string;
  historyLimit?: number;
  openShortcuts?: string[];
  /** When false, global open shortcuts are not registered (web). */
  enableDefaultShortcuts?: boolean;
};

type ErrorMap = Map<string, string>;

export type CommandRegistryContextValue = {
  store: CommandRegistryStore;
  historyStore: HistoryStore;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  query: string;
  setQuery: (q: string) => void;
  selectedIndex: number;
  setSelectedIndex: Dispatch<SetStateAction<number>>;
  runningId: string | null;
  getError: (id: string) => string | undefined;
  clearError: (id: string) => void;
  invoke: (id: CommandId) => Promise<void>;
};

const CommandRegistryContext =
  createContext<CommandRegistryContextValue | null>(null);

export function CommandRegistryProvider({
  children,
  storage,
  storageKey = DEFAULT_STORAGE_KEY,
  historyLimit = 20,
  openShortcuts = DEFAULT_OPEN_SHORTCUTS,
  enableDefaultShortcuts = true,
}: CommandRegistryProviderProps) {
  const storeRef = useRef<CommandRegistryStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = new CommandRegistryStore();
  }
  const store = storeRef.current;

  const historyStoreRef = useRef<HistoryStore | null>(null);
  if (historyStoreRef.current === null) {
    historyStoreRef.current = new HistoryStore({
      ...(storage !== undefined ? { storage } : {}),
      storageKey,
      limit: historyLimit,
    });
  }
  const historyStore = historyStoreRef.current;

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [errors, setErrors] = useState<ErrorMap>(() => new Map());
  const invokingRef = useRef(false);

  useEffect(() => {
    void historyStore.hydrate();
  }, [historyStore]);

  const open = useCallback(() => {
    setIsOpen(true);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
    setErrors(new Map());
  }, []);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [close, isOpen, open]);

  const getError = useCallback((id: string) => errors.get(id), [errors]);

  const clearError = useCallback((id: string) => {
    setErrors((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const invoke = useCallback(
    async (id: CommandId) => {
      if (invokingRef.current) {
        return;
      }
      const cmd = store.get(id);
      if (
        cmd === undefined ||
        !isCommandEnabled(cmd) ||
        !isCommandVisible(cmd)
      ) {
        return;
      }

      invokingRef.current = true;
      setErrors((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      setRunningId(id);

      try {
        await cmd.run();
        historyStore.touch(id);
        close();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : String(err ?? 'Unknown error');
        setErrors((prev) => {
          const next = new Map(prev);
          next.set(id, message);
          return next;
        });
        setIsOpen(true);
      } finally {
        setRunningId(null);
        invokingRef.current = false;
      }
    },
    [close, historyStore, store],
  );

  const value = useMemo(
    (): CommandRegistryContextValue => ({
      store,
      historyStore,
      isOpen,
      open,
      close,
      toggle,
      query,
      setQuery,
      selectedIndex,
      setSelectedIndex,
      runningId,
      getError,
      clearError,
      invoke,
    }),
    [
      store,
      historyStore,
      isOpen,
      open,
      close,
      toggle,
      query,
      selectedIndex,
      runningId,
      getError,
      clearError,
      invoke,
    ],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || !enableDefaultShortcuts) {
      return;
    }

    const onKeyDown = (ev: KeyboardEvent) => {
      const like: WebKeyboardEventLike = {
        key: ev.key,
        code: ev.code,
        metaKey: ev.metaKey,
        ctrlKey: ev.ctrlKey,
        altKey: ev.altKey,
        shiftKey: ev.shiftKey,
        repeat: ev.repeat,
        preventDefault: () => ev.preventDefault(),
      };

      if (like.repeat) {
        return;
      }

      for (const spec of openShortcuts) {
        if (matchesWebShortcut(spec, like)) {
          ev.preventDefault();
          toggle();
          return;
        }
      }

      const tryCommandShortcuts = (): boolean => {
        const all = store.getAll();
        for (const cmd of all) {
          const sc = normalizeShortcut(cmd.shortcut);
          if (sc === undefined) continue;
          const platforms = sc.platforms ?? ['web'];
          if (!platforms.includes('web')) continue;
          if (!isCommandEnabled(cmd) || !isCommandVisible(cmd)) continue;
          if (matchesWebShortcut(sc.keys, like)) {
            ev.preventDefault();
            void invoke(cmd.id);
            return true;
          }
        }
        return false;
      };

      void tryCommandShortcuts();
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [enableDefaultShortcuts, invoke, openShortcuts, store, toggle]);

  return (
    <CommandRegistryContext.Provider value={value}>
      {children}
    </CommandRegistryContext.Provider>
  );
}

export function useCommandRegistry(): CommandRegistryContextValue {
  const ctx = useContext(CommandRegistryContext);
  if (ctx === null) {
    throw new Error(
      'useCommandRegistry must be used within CommandRegistryProvider',
    );
  }
  return ctx;
}

export function useCommandRegistryOptional(): CommandRegistryContextValue | null {
  return useContext(CommandRegistryContext);
}

/** @internal */
export { CommandRegistryContext };
