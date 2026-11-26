// @io-wall-ok — browser composition root
import { createAppSyncEnginePool } from '@libs/app-env-client-ts/sync-engine-pool';
import { wallClientEnv } from '@libs/app-root-client-ts/wall-client-env';
import { wallOfflineNetworkController } from '@libs/app-root-client-ts/wall-offline-network';
import { wallSpaceRoomTransport } from '@libs/spaces-client-ts/wall-room-transport';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';
import { polyfillDisposal } from '@pkgs/polyfill-shared-ts/disposal';
import '@pkgs/ui-root-client-ts/fonts';
import '@pkgs/ui-root-client-ts/application.css';
import { renderApplication } from '@pkgs/ui-root-client-ts/render-application';
import { AdminApp, loadAdminData } from './admin-app';

polyfillDisposal();
const root = document.getElementById('root');
if (root === null)
  throw new Error('The administration app needs a root element.');
const env = wallClientEnv({
  serverUrl: location.origin,
  http: createGlobalHttpClient(),
  offline: wallOfflineNetworkController(),
  room: wallSpaceRoomTransport,
});
const pool = createAppSyncEnginePool({
  loadMutations: async () => (await loadAdminData()).mutations(),
});
const dispose = renderApplication(
  () => <AdminApp env={env} pool={pool} />,
  root
);
window.addEventListener('pagehide', () => void pool.releaseAll());
if (import.meta.hot) import.meta.hot.dispose(dispose);
