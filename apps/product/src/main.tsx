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

import { createClient } from '@libs/app-root-client/create-client';
import { wallClientEnv } from '@libs/app-root-client/wall-client-env';
import { APP_FEATURE_CLIENTS } from '@libs/runtime-client/app-feature-clients';
import { wallSpaceRoomTransport } from '@libs/spaces-client/wall-room-transport';
import { assert } from '@pkgs/assert-root-shared/singleton';
import '@pkgs/tailwind-shared/tailwind.css';
import '@pkgs/ui-root-client/tokens.css';
import '@pkgs/ui-root-client/hosts.css';
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

const HarnessBoot = lazy(async () => ({
  default: (await import('./harness-boot')).HarnessBoot,
}));

function StartupShell(): JSX.Element {
  return (
    <div
      class="startup-shell"
      role="status"
      aria-label="Starting Gamezilla"
      data-startup-shell
    >
      <svg class="startup-shell-spinner" viewBox="0 0 48 48" aria-hidden="true">
        <circle
          cx="24"
          cy="24"
          r="21.5"
          stroke="currentColor"
          stroke-width="5"
          fill="none"
          opacity="0.25"
        />
        <circle
          cx="24"
          cy="24"
          r="21.5"
          stroke="currentColor"
          stroke-width="5"
          fill="none"
          stroke-linecap="round"
          stroke-dasharray="33.77 101.32"
        />
      </svg>
      <span class="startup-shell-caption">Starting…</span>
    </div>
  );
}

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
        <Suspense fallback={<StartupShell />}>
          <HarnessBoot />
        </Suspense>
      </Match>
      <Match when={surface() === 'reports'}>
        <Suspense fallback={<StartupShell />}>
          <ReportsScreen />
        </Suspense>
      </Match>
    </Switch>
  );
}

if (!redirectedToHarness()) {
  root.replaceChildren();
  render(() => <Boot />, root);
}
