import type { Accessor } from 'solid-js';
import { useCommandRegistry } from './command-registry-context/index';
import type { CommandId } from './types';

export type UseCommandPaletteResult = {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: Accessor<boolean>;
  run: (id: CommandId) => Promise<void>;
  isRunning: Accessor<boolean>;
};

/** Open / close / run controls for the palette. */
export function useCommandPalette(): UseCommandPaletteResult {
  const reg = useCommandRegistry();
  return {
    open: reg.open,
    close: reg.close,
    toggle: reg.toggle,
    isOpen: reg.isOpen,
    run: reg.invoke,
    isRunning: () => reg.runningId() !== null,
  };
}
