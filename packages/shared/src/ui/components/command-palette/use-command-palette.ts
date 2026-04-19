import { useCommandRegistry } from './command-registry-context';

export function useCommandPalette() {
  const {
    open,
    close,
    toggle,
    isOpen,
    invoke,
    runningId,
  } = useCommandRegistry();

  return {
    open,
    close,
    toggle,
    isOpen,
    run: invoke,
    isRunning: runningId !== null,
  };
}
