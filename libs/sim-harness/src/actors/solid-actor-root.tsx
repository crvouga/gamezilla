/** @jsxImportSource solid-js */
/**
 * Solid root for one sim actor: the product `App` in embedded mode (memory
 * router, no document shortcuts) so many actors share one document, with the
 * actor's web browser drawn over it while a page is open.
 *
 * The `MemoryHistory` is created once per actor and owned here, outside the
 * component: the multi-actor session unmounts a parked actor's tree and
 * remounts it on focus, and the route must survive that round trip.
 */

import type {
  Client,
  ClientAppProps,
} from '@libs/client-app/shell/create-client';
import { TestViewportProvider } from '@pkgs/ui';
import { createMemoryHistory } from '@solidjs/router';
import type { Component, JSX } from 'solid-js';
import type { SimBrowser } from '../fabric/sim-browser';

import { SimBrowserSheet } from './sim-browser-sheet';

const ACTOR_VIEWPORT = { width: 390, height: 844 } as const;

/** The app plus the actor's browser sheet, as one `App` component. */
export function simActorApp(args: {
  readonly live: Client;
  readonly browser: SimBrowser;
  /** Shadow-root the page's own CSS (a live document, not happy-dom). */
  readonly isolateStyles: boolean;
}): Component<ClientAppProps> {
  const App = args.live.App;
  return (props) => (
    <>
      <App embedded={props.embedded} history={props.history} />
      <SimBrowserSheet
        browser={args.browser}
        isolateStyles={args.isolateStyles}
      />
    </>
  );
}

export function solidActorRoot(
  live: Client,
  browser: SimBrowser
): () => JSX.Element {
  const history = createMemoryHistory();
  const App = simActorApp({ live, browser, isolateStyles: false });
  return () => (
    <TestViewportProvider value={ACTOR_VIEWPORT}>
      <App embedded history={history} />
    </TestViewportProvider>
  );
}
