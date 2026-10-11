import { APP } from '@libs/runtime-shared/app-subs';
import { HarnessBoot } from './harness-boot';
// @io-wall-ok — browser composition root (super-app: App at `/`, Harness at `/harness`)
/**
 * Path-gated boot: `/harness` mounts the Harness screen; every other path
 * mounts the real wall
 * client (`wallClientEnv` + production/synced config). They are flat
 * siblings — the app and the harness reach each other through their command
 * palettes (`Open Harness` / `Exit harness`). Popstate remounts when
 * crossing a boundary (no nested routers). `?harness` on any other path
 * hands off to `/harness` before boot, so a launcher that can only open the
 * site root still lands in the harness.
 */

import { bootBrowserObservability } from '@libs/app-root-client/boot-browser-observability';
import { createClient } from '@libs/app-root-client/create-client';
import { wallClientEnv } from '@libs/app-root-client/wall-client-env';
import { wallOfflineNetworkController } from '@libs/app-root-client/wall-offline-network';
import { APP_SUB_CLIENTS } from '@libs/runtime-client/app-sub-clients';
import { wallSpaceRoomTransport } from '@libs/spaces-client/wall-room-transport';
import { assert } from '@pkgs/assert-root-shared/singleton';
import '@pkgs/tailwind-shared/tailwind.css';
import '@pkgs/ui-root-client/tokens.css';
import '@pkgs/ui-root-client/hosts.css';
import { createSignal, type JSX, Match, onCleanup, Switch } from 'solid-js';
import { render } from 'solid-js/web';
import { HARNESS_PATH } from './console-nav-real';
import './polyfill-entry';
import './styles.css';

const root = document.getElementById('root');
assert.ok(root !== null, 'root element is missing');

const HARNESS_FLAG = 'harness';

function isHarnessPath(pathname: string): boolean {
  return pathname === HARNESS_PATH || pathname.startsWith(`${HARNESS_PATH}/`);
}

/** Navigates to `/harness` for `?harness`; `true` means boot is handed off. */
function redirectedToHarness(): boolean {
  const { pathname, search } = window.location;
  if (isHarnessPath(pathname)) return false;
  if (!new URLSearchParams(search).has(HARNESS_FLAG)) return false;
  window.location.replace(HARNESS_PATH);
  return true;
}

function AppBoot(): JSX.Element {
  const offline = wallOfflineNetworkController();
  const env = wallClientEnv({ room: wallSpaceRoomTransport, offline });
  bootBrowserObservability({
    env,
    offline,
    dev: import.meta.env.DEV === true,
    timeOriginMs: performance.timeOrigin,
  });
  const client = createClient(env, {
    subs: APP_SUB_CLIENTS,
    loadApp: async () => APP,
    poolGlobalKey: '__gamezilla_sync_engine_pool__',
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

type Surface = 'app' | 'harness';

function surfaceAt(pathname: string): Surface {
  if (isHarnessPath(pathname)) return 'harness';
  return 'app';
}

function Boot(): JSX.Element {
  const [surface, setSurface] = createSignal(
    surfaceAt(window.location.pathname)
  );
  const onPopState = (): void => {
    setSurface(surfaceAt(window.location.pathname));
  };
  window.addEventListener('popstate', onPopState);
  onCleanup(() => window.removeEventListener('popstate', onPopState));
  return (
    <Switch fallback={<AppBoot />}>
      <Match when={surface() === 'harness'}>
        <HarnessBoot />
      </Match>
    </Switch>
  );
}

if (!redirectedToHarness()) {
  root.replaceChildren();
  render(() => <Boot />, root);
}
