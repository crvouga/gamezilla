import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useKeyboardShortcutScopeOptional } from './keyboard-shortcut-scope';
import { toWebKeyboardEventLike, type WebKeyboardEventLike } from './match';

export function useKeyboardShortcutsEnabled(enabled: boolean): boolean {
  const scope = useKeyboardShortcutScopeOptional();
  return enabled && (scope ?? true);
}

/**
 * Web capture-phase `document` keydown listener. Effective enable is
 * `enabled && (KeyboardShortcutScope.active ?? true)`. Return `true` from
 * `onKeyDown` to `preventDefault`.
 */
export function useDocumentShortcuts(options: {
  readonly enabled: boolean;
  readonly onKeyDown: (ev: WebKeyboardEventLike) => boolean | void;
}): void {
  const { enabled, onKeyDown } = options;
  const active = useKeyboardShortcutsEnabled(enabled);

  useEffect(() => {
    if (Platform.OS !== 'web' || !active) return;
    const listener = (ev: KeyboardEvent) => {
      const like = toWebKeyboardEventLike(ev);
      if (onKeyDown(like) === true) {
        ev.preventDefault();
      }
    };
    document.addEventListener('keydown', listener, true);
    return () => document.removeEventListener('keydown', listener, true);
  }, [active, onKeyDown]);
}
