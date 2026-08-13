import { useEffect } from 'react';

import { useCommands } from './registry';
import type { Command } from './types';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

function isPaletteToggle(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
}

function findMatchingCommand(
  commands: readonly Command[],
  e: KeyboardEvent
): Command | undefined {
  for (const cmd of commands) {
    if (!cmd.match) continue;
    if (cmd.when && !cmd.when()) continue;
    if (cmd.match(e)) return cmd;
  }
  return undefined;
}

export function useCommandShortcuts(): void {
  const { commands, paletteOpen, setPaletteOpen, run } = useCommands();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isPaletteToggle(e)) {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
        return;
      }
      if (paletteOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setPaletteOpen(false);
        }
        return;
      }
      if (isEditableTarget(e.target)) return;
      const cmd = findMatchingCommand(commands, e);
      if (!cmd) return;
      e.preventDefault();
      run(cmd.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commands, paletteOpen, setPaletteOpen, run]);
}
