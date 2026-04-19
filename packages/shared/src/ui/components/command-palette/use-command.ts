import { useCommandRegistry } from './command-registry-context';

export function useCommand(id: string) {
  const { store, invoke, runningId, getError } = useCommandRegistry();
  const cmd = store.get(id);

  return {
    run: () => invoke(id),
    isRunning: runningId === id,
    error: getError(id),
    exists: cmd !== undefined,
  };
}
