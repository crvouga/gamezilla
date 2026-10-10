/** @jsxImportSource solid-js */
// @io-wall-ok — browser composition root
/**
 * Web entry: builds the wall `ClientEnv` from browser APIs, creates the
 * client and mounts `client.App` (browser `Router`; the URL is the source of
 * truth). `pagehide` releases the sync engines (web OPFS handles).
 */

import { bootBrowserObservability } from '@libs/app-root-client/boot-browser-observability';
import { createClient } from '@libs/app-root-client/create-client';
import { wallClientEnv } from '@libs/app-root-client/wall-client-env';
import { wallOfflineNetworkController } from '@libs/app-root-client/wall-offline-network';
import { APP_SUB_CLIENTS } from '@libs/runtime-client/app-sub-clients';
import { APP } from '@libs/runtime-shared/app-subs';
import { wallSpaceRoomTransport } from '@libs/spaces-client/wall-room-transport';
import '@pkgs/tailwind-shared/tailwind.css';
import '@pkgs/ui-root-client/hosts.css';
import '@pkgs/ui-root-client/tokens.css';
import { render } from 'solid-js/web';

const telemetryEnv = import.meta.env as {
  readonly DEV?: boolean;
};
const offline = wallOfflineNetworkController();
const clientEnv = wallClientEnv({ room: wallSpaceRoomTransport, offline });
bootBrowserObservability({
  env: clientEnv,
  offline,
  dev: telemetryEnv.DEV === true,
  timeOriginMs: performance.timeOrigin,
});

const root = document.getElementById('root');
if (root === null) {
  throw new Error('#root element missing from index.html');
}

const client = createClient(clientEnv, {
  subs: APP_SUB_CLIENTS,
  loadApp: () => Promise.resolve(APP),
  poolGlobalKey: '__gamezilla_sync_engine_pool__',
  offlineController: offline,
});

window.addEventListener('pagehide', () => {
  void client.close();
});

root.replaceChildren();
render(() => <client.App />, root);
