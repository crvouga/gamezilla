import { type Accessor, createEffect, onCleanup } from 'solid-js';
import { useKeyboardShortcutScopeOptional } from './keyboard-shortcut-scope';
import { toWebKeyboardEventLike } from '@pkgs/ui-shared/match';
import type { WebKeyboardEventLike } from '@pkgs/ui-shared/match';

export function useKeyboardShortcutsEnabled(
  enabled: Accessor<boolean>
): Accessor<boolean> {
  const scope = useKeyboardShortcutScopeOptional();
  return () => enabled() && (scope?.() ?? true);
}

/**
 * Capture-phase `document` keydown listener. Effective enable is
 * `enabled() && (KeyboardShortcutScope.active ?? true)`. Return `true` from
 * `onKeyDown` to `preventDefault`. Listener lifetime follows the owner.
 */
export function useDocumentShortcuts(options: {
  readonly enabled: Accessor<boolean>;
  readonly onKeyDown: (ev: WebKeyboardEventLike) => boolean | undefined;
}): void {
  const active = useKeyboardShortcutsEnabled(options.enabled);
  createEffect(() => {
    if (!active() || typeof document === 'undefined') return;
    const listener = (ev: KeyboardEvent) => {
      if (options.onKeyDown(toWebKeyboardEventLike(ev)) === true) {
        ev.preventDefault();
      }
    };
    document.addEventListener('keydown', listener, true);
    onCleanup(() => document.removeEventListener('keydown', listener, true));
  });
}
