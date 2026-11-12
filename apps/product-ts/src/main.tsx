// @io-wall-ok — browser composition root
/**
 * Web entry: builds the wall `ClientEnv` from browser APIs, creates the
 * client and mounts `client.App`. The harness is not part of the
 * application: it is a site of its own (`apps/harness-ts`).
 */

import { bootBrowserObservability } from '@libs/app-root-client-ts/boot-browser-observability';
import { createClient } from '@libs/app-root-client-ts/create-client';
import { wallClientEnv } from '@libs/app-root-client-ts/wall-client-env';
import { wallOfflineNetworkController } from '@libs/app-root-client-ts/wall-offline-network';
import { technicalKey } from '@libs/product-identity-shared-ts/technical-names';
import { APP_SUB_CLIENTS } from '@libs/runtime-client-ts/app-sub-clients';
import { APP } from '@libs/runtime-shared-ts/app-subs';
import { wallSpaceRoomTransport } from '@libs/spaces-client-ts/wall-room-transport';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { monotonicClock } from '@pkgs/clock-shared-ts/wall';
import '@pkgs/tailwind-shared-ts/tailwind.css';
import '@pkgs/ui-root-client-ts/fonts';
import '@pkgs/ui-root-client-ts/tokens.css';
import '@pkgs/ui-root-client-ts/hosts.css';
import { type JSX, onCleanup } from 'solid-js';
import { render } from 'solid-js/web';
import './polyfill-entry';
import './styles.css';

const root = document.getElementById('root');
assert.ok(root !== null, 'root element is missing');

function AppBoot(): JSX.Element {
  const offline = wallOfflineNetworkController();
  const env = wallClientEnv({
    http: { fetch: (input, init) => globalThis.fetch(input, init) },
    room: wallSpaceRoomTransport,
    offline,
  });
  bootBrowserObservability({
    monotonicNow: monotonicClock.now,
    env,
    offline,
    timeOriginMs: performance.timeOrigin,
  });
  const client = createClient(env, {
    subs: APP_SUB_CLIENTS,
    loadApp: async () => APP,
    poolGlobalKey: `__${technicalKey('sync_engine_pool', '_')}__`,
    offlineController: offline,
  });
  const onPageHide = (): void => {
    void client.close();
  };
  window.addEventListener('pagehide', onPageHide);
  onCleanup(() => {
    window.removeEventListener('pagehide', onPageHide);
    void client.close();
  });
  return <client.App />;
}

root.replaceChildren();
render(() => <AppBoot />, root);
