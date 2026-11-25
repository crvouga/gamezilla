// @io-wall-ok — browser composition root
/**
 * The harness: the whole system (API servers, load balancer, Postgres, rooms,
 * pub/sub, client actors and the vendor emulators) running in this tab, with
 * the console that looks into each node. It is a site of its own -- nothing
 * of it ships in the application, and it has no servers behind it.
 */

import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { bootBrowserBugReports } from '@pkgs/feedback-client-ts/wall';
import '@pkgs/tailwind-shared-ts/tailwind.css';
import { registerUiAgentTools } from '@pkgs/ui-root-client-ts/register-ui-agent-tools';
import '@pkgs/ui-root-client-ts/fonts';
import '@pkgs/ui-root-client-ts/tokens.css';
import '@pkgs/ui-root-client-ts/hosts.css';
import { render } from '@solidjs/web';
import { onCleanup } from 'solid-js';
import './polyfill-entry';
import './styles.css';

const root = document.getElementById('root');
assert.ok(root !== null, 'root element is missing');

// Bug reporting and its right-click menu start first, so a harness that
// fails to boot can still be reported.
bootBrowserBugReports({
  build: import.meta.env.VITE_COMMIT_HASH ?? 'unknown',
  endpoint: new URL('/api/bug-reports', location.origin).href,
  startApplication: async () => {
    root.replaceChildren();
    const { HarnessBoot } = await import('./harness-boot');
    const dispose = render(() => {
      onCleanup(registerUiAgentTools());
      return <HarnessBoot />;
    }, root);
    if (import.meta.hot) import.meta.hot.dispose(dispose);
  },
});
