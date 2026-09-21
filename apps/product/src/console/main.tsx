// @io-wall-ok — browser composition root (super-app: App at `/`, Simulator at `/simulator`)
/**
 * Path-gated boot: `/simulator` mounts the Simulator screen; every other path
 * mounts the real wall client (`wallClientEnv` + production/synced config).
 * The two are flat siblings — each reaches the other through its command
 * palette (`Open Simulator` / `Exit simulator`). Popstate remounts when
 * crossing the boundary (no nested routers). `?simulator` on any other path
 * hands off to `/simulator` before boot, so a launcher that can only open the
 * site root still lands in the simulator.
 */

import { createClient } from '@libs/client-app/shell/create-client';
import { wallClientEnv } from '@libs/client-app/shell/wall-client-env';
import { assert } from '@pkgs/assert';
import '@pkgs/tailwind/tailwind.css';
import '@pkgs/ui/tokens.css';
import '@pkgs/ui/base.css';
import { createSignal, type JSX, onCleanup, Show } from 'solid-js';
import { render } from 'solid-js/web';
import { SIMULATOR_PATH } from './console-nav/console-nav-real';
import './polyfill-entry';
import { RootApp } from './root-app';
import './styles.css';
import { wallConsoleEnv } from './wall-console-env';

const root = document.getElementById('root');
assert.ok(root !== null, 'root element is missing');

const SIMULATOR_FLAG = 'simulator';

function isSimulatorPath(pathname: string): boolean {
  return (
    pathname === SIMULATOR_PATH || pathname.startsWith(`${SIMULATOR_PATH}/`)
  );
}

/** Navigates to `/simulator` for `?simulator`; `true` means boot is handed off. */
function redirectedToSimulator(): boolean {
  const { pathname, search } = window.location;
  if (isSimulatorPath(pathname)) return false;
  if (!new URLSearchParams(search).has(SIMULATOR_FLAG)) return false;
  window.location.replace(SIMULATOR_PATH);
  return true;
}

function SimulatorBoot(): JSX.Element {
  const env = wallConsoleEnv();
  return <RootApp env={env} />;
}

function AppBoot(): JSX.Element {
  const client = createClient(wallClientEnv(), {
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

function Boot(): JSX.Element {
  const [simulatorMode, setSimulatorMode] = createSignal(
    isSimulatorPath(window.location.pathname)
  );
  const onPopState = (): void => {
    setSimulatorMode(isSimulatorPath(window.location.pathname));
  };
  window.addEventListener('popstate', onPopState);
  onCleanup(() => window.removeEventListener('popstate', onPopState));
  return (
    <Show when={simulatorMode()} fallback={<AppBoot />}>
      <SimulatorBoot />
    </Show>
  );
}

if (!redirectedToSimulator()) {
  render(() => <Boot />, root);
}
