/** @jsxImportSource solid-js */
/**
 * Solid root for one harness actor: the product `App` in embedded mode (memory
 * router, no document shortcuts) so many actors share one document, with the
 * actor's web browser drawn over it while a page is open.
 *
 * The `MemoryHistory` is created once per actor and owned by the caller,
 * outside the component: the multi-actor session unmounts a parked actor's
 * tree and remounts it on focus, and the route must survive that round trip.
 * It is also how the actor opens a link (`HarnessActor.openLink`).
 */

import type {
  Client,
  ClientAppProps,
} from '@libs/client-app/shell/create-client';
import { TestViewportProvider } from '@pkgs/ui';
import type { MemoryHistory } from '@solidjs/router';
import type { Component, JSX } from 'solid-js';
import type { HarnessBrowser } from '../fabric/harness-browser';

import { HarnessBrowserSheet } from './harness-browser-sheet';

const ACTOR_VIEWPORT = { width: 390, height: 844 } as const;

/** The app plus the actor's browser sheet, as one `App` component. */
export function harnessActorApp(args: {
  readonly live: Client;
  readonly browser: HarnessBrowser;
  /** Shadow-root the page's own CSS (a live document, not happy-dom). */
  readonly isolateStyles: boolean;
}): Component<ClientAppProps> {
  const App = args.live.App;
  return (props) => (
    <>
      <App embedded={props.embedded} history={props.history} />
      <HarnessBrowserSheet
        browser={args.browser}
        isolateStyles={args.isolateStyles}
      />
    </>
  );
}

export function solidActorRoot(
  live: Client,
  browser: HarnessBrowser,
  history: MemoryHistory
): () => JSX.Element {
  const App = harnessActorApp({ live, browser, isolateStyles: false });
  return () => (
    <TestViewportProvider value={ACTOR_VIEWPORT}>
      <App embedded history={history} />
    </TestViewportProvider>
  );
}
