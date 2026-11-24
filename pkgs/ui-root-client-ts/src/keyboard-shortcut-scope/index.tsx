/** @jsxImportSource @solidjs/web */
import type { JSX } from '@solidjs/web';
import { type Accessor, createContext, useContext } from 'solid-js';

/**
 * Ambient gate for document-level keyboard shortcuts.
 * `undefined` = no gate (standalone). Hosts set `active` so only one sibling
 * subtree owns shortcuts at a time.
 */
const KeyboardShortcutScopeContext = createContext<Accessor<boolean>>();

export function KeyboardShortcutScope(props: {
  readonly active: boolean;
  readonly children: JSX.Element;
}): JSX.Element {
  const active: Accessor<boolean> = () => props.active;
  return (
    <KeyboardShortcutScopeContext value={active}>
      {props.children}
    </KeyboardShortcutScopeContext>
  );
}

/** `undefined` when outside a {@link KeyboardShortcutScope}. */
export function useKeyboardShortcutScopeOptional():
  | Accessor<boolean>
  | undefined {
  return useContext(KeyboardShortcutScopeContext);
}
