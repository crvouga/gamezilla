// @io-wall-ok — browser composition root (super-app: App at `/`, Harness at `/harness`, spec reports at `/reports`)
/**
 * Path-gated boot: `/harness` mounts the Harness screen, `/reports` the spec
 * reports screen (its own lazy chunk); every other path mounts the real wall
 * client (`wallClientEnv` + production/synced config). They are flat
 * siblings — the app and the harness reach each other through their command
 * palettes (`Open Harness` / `Exit harness`). Popstate remounts when
 * crossing a boundary (no nested routers). `?harness` on any other path
 * hands off to `/harness` before boot, so a launcher that can only open the
 * site root still lands in the harness.
 */

import { createClient } from '@libs/app-client/create-client';
import { wallClientEnv } from '@libs/app-client/wall-client-env';
import { APP_FEATURE_CLIENTS } from '@libs/runtime-client/app-feature-clients';
import { wallSpaceRoomTransport } from '@libs/spaces-client/wall-room-transport';
import { assert } from '@pkgs/assert-shared/singleton';
import '@pkgs/tailwind-shared/tailwind.css';
import '@pkgs/ui-client/tokens.css';
import '@pkgs/ui-client/hosts.css';
import {
  createSignal,
  type JSX,
  lazy,
  Match,
  onCleanup,
  Suspense,
  Switch,
} from 'solid-js';
import { render } from 'solid-js/web';
import { HARNESS_PATH } from './console-nav-real';
import './polyfill-entry';
import { isReportsPath } from './reports-path';
import { RootApp } from './root-app';
import './styles.css';
import { wallConsoleEnv } from './wall-console-env';

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

function HarnessBoot(): JSX.Element {
  const env = wallConsoleEnv();
  return <RootApp env={env} />;
}

function AppBoot(): JSX.Element {
  const client = createClient(wallClientEnv({ room: wallSpaceRoomTransport }), {
    features: APP_FEATURE_CLIENTS,
    loadApp: async () =>
      (await import('@libs/runtime-shared/app-features')).APP,
    poolGlobalKey: '__gamezilla_sync_engine_pool__',
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

const ReportsScreen = lazy(async () => ({
  default: (await import('./reports-screen')).ReportsScreen,
}));

type Surface = 'app' | 'harness' | 'reports';

function surfaceAt(pathname: string): Surface {
  if (isHarnessPath(pathname)) return 'harness';
  if (isReportsPath(pathname)) return 'reports';
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
      <Match when={surface() === 'reports'}>
        <Suspense>
          <ReportsScreen />
        </Suspense>
      </Match>
    </Switch>
  );
}

if (!redirectedToHarness()) {
  render(() => <Boot />, root);
}
