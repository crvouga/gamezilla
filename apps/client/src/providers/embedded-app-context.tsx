/**
 * Marks this product App tree as an embedded multi-App host (playground).
 * Disables document-global shortcuts / PWA prompts that would collide across trees.
 */

import { createContext, type ReactNode, useContext } from 'react';

const EmbeddedAppContext = createContext(false);

export function EmbeddedAppProvider(props: {
  readonly embedded: boolean;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <EmbeddedAppContext.Provider value={props.embedded}>
      {props.children}
    </EmbeddedAppContext.Provider>
  );
}

export function useEmbeddedApp(): boolean {
  return useContext(EmbeddedAppContext);
}
