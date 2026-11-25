/** @jsxImportSource @solidjs/web */
/**
 * Whether this product App is one of several mounted in a single page
 * (multi-App product-harness). Embedded Apps use an in-memory router and leave
 * document-level shortcuts / PWA prompts to the host.
 */

import type { JSX } from '@solidjs/web';
import { createContext, untrack, useContext } from 'solid-js';

const EmbeddedAppContext = createContext<boolean>(false);

export function EmbeddedAppProvider(props: {
  readonly embedded: boolean;
  readonly children: JSX.Element;
}): JSX.Element {
  // Composition-root configuration: read once, not tracked.
  const embedded = untrack(() => props.embedded);
  return (
    <EmbeddedAppContext value={embedded}>{props.children}</EmbeddedAppContext>
  );
}

export function useEmbeddedApp(): boolean {
  return useContext(EmbeddedAppContext);
}
