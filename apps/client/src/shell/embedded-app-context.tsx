/** @jsxImportSource solid-js */
/**
 * Whether this product App is one of several mounted in a single page
 * (multi-App playground). Embedded Apps use an in-memory router and leave
 * document-level shortcuts / PWA prompts to the host.
 */

import { createContext, type JSX, untrack, useContext } from 'solid-js';

const EmbeddedAppContext = createContext<boolean>(false);

export function EmbeddedAppProvider(props: {
  readonly embedded: boolean;
  readonly children: JSX.Element;
}): JSX.Element {
  // Composition-root configuration: read once, not tracked.
  const embedded = untrack(() => props.embedded);
  return (
    <EmbeddedAppContext.Provider value={embedded}>
      {props.children}
    </EmbeddedAppContext.Provider>
  );
}

export function useEmbeddedApp(): boolean {
  return useContext(EmbeddedAppContext);
}
