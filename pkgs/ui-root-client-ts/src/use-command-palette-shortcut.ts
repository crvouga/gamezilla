/**
 * `useCommandPaletteShortcut` -- bind ⌘K / Ctrl+K (or custom specs) on
 * `document` to toggle the palette. Only needed when the provider was
 * mounted with `enableDefaultShortcuts={false}`; the default provider binds
 * the open shortcuts itself.
 */

import type { Accessor } from 'solid-js';
import { useCommandRegistry } from './command-registry-context/index';
import {
  DEFAULT_OPEN_SHORTCUTS,
  matchOpenShortcut,
} from './command-registry-shortcuts';
import { useDocumentShortcuts } from './use-document-shortcuts';

export type CommandPaletteShortcutOptions = {
  /** Shortcut specs, e.g. `['mod+k']`. Defaults to `mod+k` / `mod+shift+p`. */
  keys?: readonly string[] | undefined;
  enabled?: Accessor<boolean> | undefined;
};

export function useCommandPaletteShortcut(
  options: CommandPaletteShortcutOptions = {}
): void {
  const reg = useCommandRegistry();
  const keys = options.keys ?? DEFAULT_OPEN_SHORTCUTS;
  useDocumentShortcuts({
    enabled: options.enabled ?? ((): boolean => true),
    onKeyDown: (like) => {
      if (like.repeat || !matchOpenShortcut(like, keys)) return false;
      reg.toggle();
      return true;
    },
  });
}
