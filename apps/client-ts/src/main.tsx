/** @jsxImportSource solid-js */
// @io-wall-ok — browser composition root
/**
 * Web entry: builds the wall `ClientEnv` from browser APIs, creates the
 * client and mounts `client.App` (browser `Router`; the URL is the source of
 * truth). `pagehide` releases the sync engines (web OPFS handles).
 */

import { bootBrowserObservability } from '@libs/app-root-client-ts/boot-browser-observability';
import { createClient } from '@libs/app-root-client-ts/create-client';
import { wallClientEnv } from '@libs/app-root-client-ts/wall-client-env';
import { wallOfflineNetworkController } from '@libs/app-root-client-ts/wall-offline-network';
import { technicalKey } from '@libs/product-identity-shared-ts/technical-names';
import { APP_SUB_CLIENTS } from '@libs/runtime-client-ts/app-sub-clients';
import { APP } from '@libs/runtime-shared-ts/app-subs';
import { wallSpaceRoomTransport } from '@libs/spaces-client-ts/wall-room-transport';
import '@pkgs/tailwind-shared-ts/tailwind.css';
import '@pkgs/ui-root-client-ts/hosts.css';
import '@pkgs/ui-root-client-ts/tokens.css';
import { render } from 'solid-js/web';

const offline = wallOfflineNetworkController();
const clientEnv = wallClientEnv({ room: wallSpaceRoomTransport, offline });
bootBrowserObservability({
  env: clientEnv,
  offline,
  timeOriginMs: performance.timeOrigin,
});

const root = document.getElementById('root');
if (root === null) {
  throw new Error('#root element missing from index.html');
}

const client = createClient(clientEnv, {
  subs: APP_SUB_CLIENTS,
  loadApp: () => Promise.resolve(APP),
  poolGlobalKey: `__${technicalKey('sync_engine_pool', '_')}__`,
  offlineController: offline,
});

window.addEventListener('pagehide', () => {
  void client.close();
});

root.replaceChildren();
render(() => <client.App />, root);
