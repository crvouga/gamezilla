import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { Command } from './types';

type CommandsApi = {
  readonly commands: readonly Command[];
  readonly setCommands: (next: readonly Command[]) => void;
  readonly run: (id: string) => void;
  readonly paletteOpen: boolean;
  readonly setPaletteOpen: (open: boolean) => void;
};

const CommandsContext = createContext<CommandsApi | null>(null);

export function CommandsProvider(props: { readonly children: ReactNode }) {
  const { children } = props;
  const [commands, setCommands] = useState<readonly Command[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const run = useCallback(
    (id: string) => {
      const cmd = commands.find((c) => c.id === id);
      if (!cmd) return;
      if (cmd.when && !cmd.when()) return;
      cmd.run();
    },
    [commands]
  );

  const value = useMemo(
    () => ({
      commands,
      setCommands,
      run,
      paletteOpen,
      setPaletteOpen,
    }),
    [commands, run, paletteOpen]
  );

  return (
    <CommandsContext.Provider value={value}>
      {children}
    </CommandsContext.Provider>
  );
}

export function useCommands(): CommandsApi {
  const ctx = useContext(CommandsContext);
  if (ctx === null) {
    throw new Error('useCommands requires CommandsProvider');
  }
  return ctx;
}

/** Stable key for when the registered command *set* changes (not handler identity). */
function commandsIdentityKey(commands: readonly Command[]): string {
  return commands
    .map((c) => `${c.id}\0${c.label}\0${c.section}\0${c.shortcut ?? ''}`)
    .join('\n');
}

/**
 * Register page commands. Rebinds when the command set identity changes;
 * latest `run` / `when` / `match` are always read from a ref so unstable
 * callback props (inline `onOpen`, etc.) do not trigger setState loops.
 */
export function useRegisterCommands(commands: readonly Command[]): void {
  const { setCommands } = useCommands();
  const latest = useRef(commands);
  latest.current = commands;
  const key = commandsIdentityKey(commands);

  useEffect(() => {
    const wrap = (list: readonly Command[]): Command[] =>
      list.map((c) => ({
        id: c.id,
        label: c.label,
        section: c.section,
        run: () => {
          latest.current.find((x) => x.id === c.id)?.run();
        },
        ...(c.shortcut !== undefined ? { shortcut: c.shortcut } : {}),
        ...(c.when
          ? {
              when: () =>
                latest.current.find((x) => x.id === c.id)?.when?.() ?? true,
            }
          : {}),
        ...(c.match
          ? {
              match: (e: KeyboardEvent) =>
                latest.current.find((x) => x.id === c.id)?.match?.(e) ?? false,
            }
          : {}),
      }));

    setCommands(wrap(latest.current));
    return () => setCommands([]);
  }, [key, setCommands]);
}
