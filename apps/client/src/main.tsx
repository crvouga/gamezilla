/** @jsxImportSource solid-js */
// @io-wall-ok — browser composition root
/**
 * Web entry: builds the wall `ClientEnv` from browser APIs, creates the
 * client and mounts `client.App` (browser `Router`; the URL is the source of
 * truth). `pagehide` releases the sync engines (web OPFS handles).
 */

import { render } from 'solid-js/web';

import '@pkgs/tailwind/tailwind.css';
import '@pkgs/ui/tokens.css';
import '@pkgs/ui/base.css';
import { createClient } from '@libs/client-app/shell/create-client';
import { wallClientEnv } from '@libs/client-app/shell/wall-client-env';
import { APP_FEATURE_CLIENTS } from '@libs/runtime/root/client/app-feature-clients';
import { wallSpaceRoomTransport } from '@libs/spaces/root/client/room/wall-room-transport';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('#root element missing from index.html');
}

const client = createClient(wallClientEnv({ room: wallSpaceRoomTransport }), {
  features: APP_FEATURE_CLIENTS,
  loadApp: async () => (await import('@libs/runtime/root/app-features')).APP,
  poolGlobalKey: '__gamezilla_sync_engine_pool__',
});

window.addEventListener('pagehide', () => {
  void client.close();
});

render(() => <client.App />, root);
