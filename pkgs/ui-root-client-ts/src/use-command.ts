import type { Accessor } from 'solid-js';
import { useCommandRegistry } from './command-registry-context/index';

export type UseCommandResult = {
  run: () => Promise<void>;
  isRunning: Accessor<boolean>;
  error: Accessor<string | undefined>;
  exists: Accessor<boolean>;
};

/** Reactive handle to one registered command by id. */
export function useCommand(id: string): UseCommandResult {
  const reg = useCommandRegistry();
  return {
    run: () => reg.invoke(id),
    isRunning: () => reg.runningId() === id,
    error: () => reg.getError(id),
    exists: () => reg.commands().some((cmd) => cmd.id === id),
  };
}
