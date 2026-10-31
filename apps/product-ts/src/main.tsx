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
 *
 * The application graph is imported eagerly. The harness is not application
 * code: its graph (in-browser servers, Postgres, the console) loads only when
 * the page opens on `/harness`, so opening the app never pays for it.
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
import '@pkgs/ui-root-client-ts/tokens.css';
import '@pkgs/ui-root-client-ts/hosts.css';
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

type Surface = 'app' | 'harness';

function surfaceAt(pathname: string): Surface {
  if (isHarnessPath(pathname)) return 'harness';
  return 'app';
}

/**
 * The harness graph, when the page opened on it. Awaited before first render
 * so `root.ts`'s startup boundary owns the load: the `index.html` spinner
 * holds, and a failed import recovers or reports like the application's.
 */
const HarnessBoot = isHarnessPath(window.location.pathname)
  ? (await import('./harness-boot')).HarnessBoot
  : null;

function HarnessSurface(): JSX.Element {
  const Harness = HarnessBoot;
  assert.ok(Harness !== null, 'the harness graph is not loaded');
  return <Harness />;
}

function Boot(): JSX.Element {
  const [surface, setSurface] = createSignal(
    surfaceAt(window.location.pathname)
  );
  const onPopState = (): void => {
    const next = surfaceAt(window.location.pathname);
    // History crossed into the harness from an application boot: its graph
    // is not loaded, so open it as the document it is.
    if (next === 'harness' && HarnessBoot === null) {
      window.location.reload();
      return;
    }
    setSurface(next);
  };
  window.addEventListener('popstate', onPopState);
  onCleanup(() => window.removeEventListener('popstate', onPopState));
  return (
    <Switch fallback={<AppBoot />}>
      <Match when={surface() === 'harness'}>
        <HarnessSurface />
      </Match>
    </Switch>
  );
}

if (!redirectedToHarness()) {
  root.replaceChildren();
  render(() => <Boot />, root);
}
