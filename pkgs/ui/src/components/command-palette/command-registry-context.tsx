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
import {
  matchesWebShortcut,
  type WebKeyboardEventLike,
} from './keyboard-shortcut';
import type { CommandId } from './types';
import { isCommandEnabled, isCommandVisible, normalizeShortcut } from './types';

const DEFAULT_OPEN_SHORTCUTS = ['mod+k', 'mod+shift+p'];
const DEFAULT_STORAGE_KEY = '@app/command-history';

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

function useStableStore(): CommandRegistryStore {
  const ref = useRef<CommandRegistryStore | null>(null);
  if (ref.current === null) ref.current = new CommandRegistryStore();
  return ref.current;
}

function useStableHistoryStore(
  storage: ThemePreferenceStorage | undefined,
  storageKey: string,
  historyLimit: number
): HistoryStore {
  const ref = useRef<HistoryStore | null>(null);
  if (ref.current === null) {
    ref.current = new HistoryStore({
      ...(storage !== undefined ? { storage } : {}),
      storageKey,
      limit: historyLimit,
    });
  }
  return ref.current;
}

type ProviderState = {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  selectedIndex: number;
  setSelectedIndex: Dispatch<SetStateAction<number>>;
  runningId: string | null;
  setRunningId: Dispatch<SetStateAction<string | null>>;
  errors: ErrorMap;
  setErrors: Dispatch<SetStateAction<ErrorMap>>;
  invokingRef: React.MutableRefObject<boolean>;
};

function useProviderState(): ProviderState {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [errors, setErrors] = useState<ErrorMap>(() => new Map());
  const invokingRef = useRef(false);
  return {
    isOpen,
    setIsOpen,
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex,
    runningId,
    setRunningId,
    errors,
    setErrors,
    invokingRef,
  };
}

function useOpenCloseToggle(state: ProviderState) {
  const { isOpen, setIsOpen, setQuery, setSelectedIndex, setErrors } = state;
  const open = useCallback(() => {
    setIsOpen(true);
    setQuery('');
    setSelectedIndex(0);
  }, [setIsOpen, setQuery, setSelectedIndex]);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
    setErrors(new Map());
  }, [setIsOpen, setQuery, setSelectedIndex, setErrors]);
  const toggle = useCallback(
    () => (isOpen ? close() : open()),
    [close, isOpen, open]
  );
  return { open, close, toggle };
}

function useErrorActions(state: ProviderState) {
  const { errors, setErrors } = state;
  const getError = useCallback((id: string) => errors.get(id), [errors]);
  const clearError = useCallback(
    (id: string) => {
      setErrors((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    },
    [setErrors]
  );
  return { getError, clearError };
}

function useInvoke(
  store: CommandRegistryStore,
  historyStore: HistoryStore,
  state: ProviderState,
  close: () => void
) {
  const { invokingRef, setErrors, setRunningId, setIsOpen } = state;
  return useCallback(
    async (id: CommandId) => {
      if (invokingRef.current) return;
      const cmd = store.get(id);
      if (cmd === undefined || !isCommandEnabled(cmd) || !isCommandVisible(cmd))
        return;
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
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : 'Unknown error';
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
    [
      close,
      historyStore,
      invokingRef,
      setErrors,
      setIsOpen,
      setRunningId,
      store,
    ]
  );
}

function toKeyboardEventLike(ev: KeyboardEvent): WebKeyboardEventLike {
  return {
    key: ev.key,
    code: ev.code,
    metaKey: ev.metaKey,
    ctrlKey: ev.ctrlKey,
    altKey: ev.altKey,
    shiftKey: ev.shiftKey,
    repeat: ev.repeat,
    preventDefault: () => ev.preventDefault(),
  };
}

function matchOpenShortcut(
  like: WebKeyboardEventLike,
  openShortcuts: string[]
): boolean {
  for (const spec of openShortcuts) {
    if (matchesWebShortcut(spec, like)) return true;
  }
  return false;
}

function findCommandForShortcut(
  store: CommandRegistryStore,
  like: WebKeyboardEventLike
) {
  for (const cmd of store.getAll()) {
    const sc = normalizeShortcut(cmd.shortcut);
    if (sc === undefined) continue;
    const platforms = sc.platforms ?? ['web'];
    if (!platforms.includes('web')) continue;
    if (!isCommandEnabled(cmd) || !isCommandVisible(cmd)) continue;
    if (matchesWebShortcut(sc.keys, like)) return cmd;
  }
  return undefined;
}

function useGlobalShortcuts({
  enabled,
  openShortcuts,
  store,
  toggle,
  invoke,
}: {
  enabled: boolean;
  openShortcuts: string[];
  store: CommandRegistryStore;
  toggle: () => void;
  invoke: (id: CommandId) => Promise<void>;
}) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      const like = toKeyboardEventLike(ev);
      if (like.repeat) return;
      if (matchOpenShortcut(like, openShortcuts)) {
        ev.preventDefault();
        toggle();
        return;
      }
      const cmd = findCommandForShortcut(store, like);
      if (cmd !== undefined) {
        ev.preventDefault();
        void invoke(cmd.id);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, invoke, openShortcuts, store, toggle]);
}

export function CommandRegistryProvider({
  children,
  storage,
  storageKey = DEFAULT_STORAGE_KEY,
  historyLimit = 20,
  openShortcuts = DEFAULT_OPEN_SHORTCUTS,
  enableDefaultShortcuts = true,
}: CommandRegistryProviderProps) {
  const store = useStableStore();
  const historyStore = useStableHistoryStore(storage, storageKey, historyLimit);
  const state = useProviderState();

  useEffect(() => {
    void historyStore.hydrate();
  }, [historyStore]);

  const { open, close, toggle } = useOpenCloseToggle(state);
  const { getError, clearError } = useErrorActions(state);
  const invoke = useInvoke(store, historyStore, state, close);

  const value = useMemo(
    (): CommandRegistryContextValue => ({
      store,
      historyStore,
      isOpen: state.isOpen,
      open,
      close,
      toggle,
      query: state.query,
      setQuery: state.setQuery,
      selectedIndex: state.selectedIndex,
      setSelectedIndex: state.setSelectedIndex,
      runningId: state.runningId,
      getError,
      clearError,
      invoke,
    }),
    [
      store,
      historyStore,
      state.isOpen,
      open,
      close,
      toggle,
      state.query,
      state.setQuery,
      state.selectedIndex,
      state.setSelectedIndex,
      state.runningId,
      getError,
      clearError,
      invoke,
    ]
  );

  useGlobalShortcuts({
    enabled: enableDefaultShortcuts,
    openShortcuts,
    store,
    toggle,
    invoke,
  });

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
      'useCommandRegistry must be used within CommandRegistryProvider'
    );
  }
  return ctx;
}

export function useCommandRegistryOptional(): CommandRegistryContextValue | null {
  return useContext(CommandRegistryContext);
}

/** @internal */
export { CommandRegistryContext };
