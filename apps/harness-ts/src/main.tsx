// @io-wall-ok — browser composition root
/**
 * The harness: the whole system (API servers, load balancer, Postgres, rooms,
 * pub/sub, client actors and the vendor emulators) running in this tab, with
 * the console that looks into each node. It is a site of its own -- nothing
 * of it ships in the application, and it has no servers behind it.
 */

import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import '@pkgs/tailwind-shared-ts/tailwind.css';
import '@pkgs/ui-root-client-ts/fonts';
import '@pkgs/ui-root-client-ts/tokens.css';
import '@pkgs/ui-root-client-ts/hosts.css';
import { render } from 'solid-js/web';
import './polyfill-entry';
import './styles.css';

const root = document.getElementById('root');
assert.ok(root !== null, 'root element is missing');

// Loaded after the polyfills above: the system's graph reads them as its
// modules are evaluated.
const { HarnessBoot } = await import('./harness-boot');
root.replaceChildren();
render(() => <HarnessBoot />, root);
