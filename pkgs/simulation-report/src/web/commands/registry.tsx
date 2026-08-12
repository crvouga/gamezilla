import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

export function useRegisterCommands(commands: readonly Command[]): void {
  const { setCommands } = useCommands();
  useEffect(() => {
    setCommands(commands);
    return () => setCommands([]);
  }, [commands, setCommands]);
}
