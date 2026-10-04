/**
 * Document-level shortcut wiring for the command registry: the palette open
 * shortcuts (`mod+k`, `mod+shift+p`) and per-command `shortcut` bindings.
 */

import type { Accessor } from 'solid-js';
import { matchesWebShortcut } from '@pkgs/ui-shared/match';
import { useDocumentShortcuts } from './use-document-shortcuts';
import type { WebKeyboardEventLike } from '@pkgs/ui-shared/match';
import type { CommandRegistryStore } from './command-registry-store';
import type { CommandId, RegisteredCommand } from './types';
import { isCommandEnabled, isCommandVisible, normalizeShortcut } from './types';

export const DEFAULT_OPEN_SHORTCUTS: readonly string[] = [
  'mod+k',
  'mod+shift+p',
];

export function matchOpenShortcut(
  like: WebKeyboardEventLike,
  openShortcuts: readonly string[]
): boolean {
  return openShortcuts.some((spec) => matchesWebShortcut(spec, like));
}

/** First enabled + visible command whose web shortcut matches `like`. */
export function findCommandForShortcut(
  commands: readonly RegisteredCommand[],
  like: WebKeyboardEventLike
): RegisteredCommand | undefined {
  return commands.find((cmd) => {
    const sc = normalizeShortcut(cmd.shortcut);
    if (sc === undefined) return false;
    const platforms = sc.platforms ?? ['web'];
    if (!platforms.includes('web')) return false;
    if (!isCommandEnabled(cmd) || !isCommandVisible(cmd)) return false;
    return matchesWebShortcut(sc.keys, like);
  });
}

/**
 * Bind the palette open shortcuts and every registered command shortcut on
 * `document` while `enabled()` (and the ambient `KeyboardShortcutScope`) allow.
 */
export function useRegistryDocumentShortcuts(options: {
  readonly enabled: Accessor<boolean>;
  readonly openShortcuts: readonly string[];
  readonly store: CommandRegistryStore;
  readonly toggle: () => void;
  readonly invoke: (id: CommandId) => Promise<void>;
}): void {
  useDocumentShortcuts({
    enabled: options.enabled,
    onKeyDown: (like) => {
      if (like.repeat) return false;
      if (matchOpenShortcut(like, options.openShortcuts)) {
        options.toggle();
        return true;
      }
      const cmd = findCommandForShortcut(options.store.getSnapshot(), like);
      if (cmd !== undefined) {
        void options.invoke(cmd.id);
        return true;
      }
      return false;
    },
  });
}
