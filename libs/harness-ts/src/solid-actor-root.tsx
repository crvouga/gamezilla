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
} from '@libs/app-root-client-ts/create-client';
import { KeyboardShortcutScope } from '@pkgs/ui-root-client-ts/keyboard-shortcut-scope';
import { TestViewportProvider } from '@pkgs/ui-root-client-ts/test-viewport';
import type { MemoryHistory } from '@solidjs/router';
import type { Component, JSX } from 'solid-js';
import type { HarnessBrowser } from './browser';

import { HarnessBrowserSheet } from './browser-sheet';

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

export function solidActorRoot(args: {
  readonly live: Client;
  readonly browser: HarnessBrowser;
  readonly history: MemoryHistory;
  readonly viewport: { width: number; height: number };
  readonly shortcutsActive: () => boolean;
}): () => JSX.Element {
  const App = harnessActorApp({ ...args, isolateStyles: false });
  return () => (
    <TestViewportProvider value={args.viewport}>
      <KeyboardShortcutScope active={args.shortcutsActive()}>
        <App embedded history={args.history} />
      </KeyboardShortcutScope>
    </TestViewportProvider>
  );
}
