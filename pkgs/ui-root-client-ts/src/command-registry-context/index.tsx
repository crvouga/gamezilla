/** @jsxImportSource solid-js */

import type { Keyword } from '@pkgs/keyword-shared-ts/keyword';
import { useKvOptional } from '@pkgs/kv-root-client-ts/solid';
import type { Kv } from '@pkgs/kv-root-shared-ts/interface';
import { createSubscriptionSignal } from '@pkgs/solid-context-client-ts/subscription-signal';
import type { HistorySnapshot } from '@pkgs/ui-root-shared-ts/history-store';
import { HistoryStore } from '@pkgs/ui-root-shared-ts/history-store';
import {
  type Accessor,
  createContext,
  createEffect,
  createSignal,
  type JSX,
  untrack,
  useContext,
} from 'solid-js';
import {
  DEFAULT_OPEN_SHORTCUTS,
  useRegistryDocumentShortcuts,
} from '../command-registry-shortcuts';
import type { CommandRegistrySnapshot } from '../command-registry-store';
import { CommandRegistryStore } from '../command-registry-store';
import type { CommandId } from '../types';
import { isCommandEnabled, isCommandVisible } from '../types';
import { useKeyboardShortcutsEnabled } from '../use-document-shortcuts';

export type CommandRegistryProviderProps = {
  children: JSX.Element;
  /** Optional override; defaults to the ambient `KvProvider` (or none). */
  kv?: Kv | null | undefined;
  storageKey?: Keyword | undefined;
  historyLimit?: number | undefined;
  openShortcuts?: readonly string[] | undefined;
  /** When false, no document shortcuts are registered. Default `true`. */
  enableDefaultShortcuts?: boolean | undefined;
};

export type CommandRegistryContextValue = {
  readonly store: CommandRegistryStore;
  readonly historyStore: HistoryStore;
  /** Reactive registry snapshot. */
  readonly commands: Accessor<CommandRegistrySnapshot>;
  /** Reactive recent-command ids (most recent first). */
  readonly historyIds: Accessor<HistorySnapshot>;
  readonly isOpen: Accessor<boolean>;
  readonly open: () => void;
  readonly close: () => void;
  readonly toggle: () => void;
  readonly query: Accessor<string>;
  readonly setQuery: (query: string) => void;
  readonly selectedIndex: Accessor<number>;
  readonly setSelectedIndex: (
    next: number | ((prev: number) => number)
  ) => void;
  readonly runningId: Accessor<string | null>;
  readonly getError: (id: string) => string | undefined;
  readonly clearError: (id: string) => void;
  readonly invoke: (id: CommandId) => Promise<void>;
};

const CommandRegistryContext = createContext<CommandRegistryContextValue>();

type PaletteState = {
  isOpen: Accessor<boolean>;
  setIsOpen: (next: boolean) => void;
  query: Accessor<string>;
  setQuery: (next: string) => void;
  selectedIndex: Accessor<number>;
  setSelectedIndex: (next: number | ((prev: number) => number)) => void;
  runningId: Accessor<string | null>;
  setRunningId: (next: string | null) => void;
  errors: Accessor<ReadonlyMap<string, string>>;
  setErrors: (next: ReadonlyMap<string, string>) => void;
};

function createPaletteState(): PaletteState {
  const [isOpen, setIsOpen] = createSignal(false);
  const [query, setQuery] = createSignal('');
  const [selectedIndex, setSelected] = createSignal(0);
  const [runningId, setRunningId] = createSignal<string | null>(null);
  const [errors, setErrorsRaw] = createSignal<ReadonlyMap<string, string>>(
    new Map()
  );
  return {
    isOpen,
    setIsOpen,
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex: (next) => {
      setSelected((prev) => (typeof next === 'function' ? next(prev) : next));
    },
    runningId,
    setRunningId,
    errors,
    setErrors: (next) => setErrorsRaw(() => next),
  };
}

function withoutError(
  errors: ReadonlyMap<string, string>,
  id: string
): ReadonlyMap<string, string> {
  if (!errors.has(id)) return errors;
  const next = new Map(errors);
  next.delete(id);
  return next;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error';
}

function createInvoke(args: {
  store: CommandRegistryStore;
  historyStore: HistoryStore;
  state: PaletteState;
  close: () => void;
}): (id: CommandId) => Promise<void> {
  const { store, historyStore, state, close } = args;
  let invoking = false;
  return async (id) => {
    if (invoking) return;
    const cmd = store.get(id);
    if (cmd === undefined || !isCommandEnabled(cmd) || !isCommandVisible(cmd)) {
      return;
    }
    invoking = true;
    state.setErrors(withoutError(untrack(state.errors), id));
    state.setRunningId(id);
    try {
      await cmd.run();
      historyStore.touch(id);
      close();
    } catch (err: unknown) {
      const next = new Map(untrack(state.errors));
      next.set(id, errorMessage(err));
      state.setErrors(next);
      state.setIsOpen(true);
    } finally {
      state.setRunningId(null);
      invoking = false;
    }
  };
}

function createContextValue(args: {
  store: CommandRegistryStore;
  historyStore: HistoryStore;
}): CommandRegistryContextValue {
  const { store, historyStore } = args;
  const state = createPaletteState();
  const open = (): void => {
    state.setIsOpen(true);
    state.setQuery('');
    state.setSelectedIndex(0);
  };
  const close = (): void => {
    state.setIsOpen(false);
    state.setQuery('');
    state.setSelectedIndex(0);
    state.setErrors(new Map());
  };
  const toggle = (): void => (untrack(state.isOpen) ? close() : open());
  return {
    store,
    historyStore,
    commands: createSubscriptionSignal(store),
    historyIds: createSubscriptionSignal(historyStore),
    isOpen: state.isOpen,
    open,
    close,
    toggle,
    query: state.query,
    setQuery: state.setQuery,
    selectedIndex: state.selectedIndex,
    setSelectedIndex: state.setSelectedIndex,
    runningId: state.runningId,
    getError: (id) => state.errors().get(id),
    clearError: (id) =>
      state.setErrors(withoutError(untrack(state.errors), id)),
    invoke: createInvoke({ store, historyStore, state, close }),
  };
}

/**
 * `CommandRegistryProvider` -- app-level command registry + palette state.
 *
 * Owns the {@link CommandRegistryStore} (registered commands), the
 * {@link HistoryStore} (recent ids, optionally persisted through `Kv`), the
 * palette open / query / selection state, and `invoke`, which runs a command
 * with running + error tracking. Both stores are bridged into Solid signals
 * with `createSubscriptionSignal`.
 */
export function CommandRegistryProvider(
  props: CommandRegistryProviderProps
): JSX.Element {
  const ambientKv = useKvOptional();
  // Static configuration: read once, like every other service provider.
  const config = untrack(() => ({
    kv: props.kv !== undefined ? props.kv : (ambientKv ?? null),
    storageKey: props.storageKey,
    historyLimit: props.historyLimit,
    openShortcuts: props.openShortcuts ?? DEFAULT_OPEN_SHORTCUTS,
  }));
  const store = new CommandRegistryStore();
  const historyStore = new HistoryStore({
    kv: config.kv,
    storageKey: config.storageKey,
    limit: config.historyLimit,
  });
  void historyStore.hydrate();
  const value = createContextValue({ store, historyStore });

  // Reactive: hosts (harness) gate shortcuts on focus without remounting.
  const shortcutsEnabled = (): boolean => props.enableDefaultShortcuts ?? true;
  useRegistryDocumentShortcuts({
    enabled: shortcutsEnabled,
    openShortcuts: config.openShortcuts,
    store,
    toggle: value.toggle,
    invoke: value.invoke,
  });
  // Close when an enclosing `KeyboardShortcutScope` deactivates (another
  // overlay took over), regardless of whether default shortcuts are bound.
  const scopeActive = useKeyboardShortcutsEnabled(() => true);
  createEffect(() => {
    if (!scopeActive() && value.isOpen()) value.close();
  });

  return (
    <CommandRegistryContext.Provider value={value}>
      {props.children}
    </CommandRegistryContext.Provider>
  );
}

export function useCommandRegistry(): CommandRegistryContextValue {
  const ctx = useContext(CommandRegistryContext);
  if (ctx === undefined) {
    throw new Error(
      'useCommandRegistry must be used within CommandRegistryProvider'
    );
  }
  return ctx;
}

export function useCommandRegistryOptional():
  | CommandRegistryContextValue
  | undefined {
  return useContext(CommandRegistryContext);
}
