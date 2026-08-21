import { createContext, type ReactNode, useContext } from 'react';

/**
 * Ambient gate for document-level keyboard shortcuts.
 * `undefined` = no gate (standalone). Hosts set `active` so only one sibling
 * subtree owns shortcuts at a time.
 */
const KeyboardShortcutScopeContext = createContext<boolean | undefined>(
  undefined
);

export function KeyboardShortcutScope(props: {
  readonly active: boolean;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <KeyboardShortcutScopeContext.Provider value={props.active}>
      {props.children}
    </KeyboardShortcutScopeContext.Provider>
  );
}

/** `undefined` when outside a {@link KeyboardShortcutScope}. */
export function useKeyboardShortcutScopeOptional(): boolean | undefined {
  return useContext(KeyboardShortcutScopeContext);
}
