// @io-wall-ok — browser composition root (super-app: App at `/`, console at `/console`)
/**
 * Path-gated boot: `/console` mounts the Tests + Simulator console; every other
 * path mounts the real wall client (`wallClientEnv` + production/synced config).
 * Popstate remounts when crossing the console boundary (no nested routers).
 * `?console` on any other path hands off to `/console` before boot, so a
 * launcher that can only open the site root still lands in the simulator.
 */

import { createClient } from '@apps/client/shell/create-client';
import { wallClientEnv } from '@apps/client/shell/wall-client-env';
import { assert } from '@pkgs/assert';
import '@pkgs/tailwind/tailwind.css';
import '@pkgs/ui/tokens.css';
import '@pkgs/ui/base.css';
import { createSignal, type JSX, onCleanup, Show } from 'solid-js';
import { render } from 'solid-js/web';
import './polyfill-entry';
import { RootApp } from './root-app';
import './styles.css';
import { wallConsoleEnv } from './wall-console-env';

const root = document.getElementById('root');
assert.ok(root !== null, 'root element is missing');

const CONSOLE_FLAG = 'console';

function isConsolePath(pathname: string): boolean {
  return pathname === '/console' || pathname.startsWith('/console/');
}

/** Navigates to `/console` for `?console`; `true` means boot is handed off. */
function redirectedToConsole(): boolean {
  const { pathname, search } = window.location;
  if (isConsolePath(pathname)) return false;
  if (!new URLSearchParams(search).has(CONSOLE_FLAG)) return false;
  window.location.replace('/console');
  return true;
}

function ConsoleBoot(): JSX.Element {
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
  const [consoleMode, setConsoleMode] = createSignal(
    isConsolePath(window.location.pathname)
  );
  const onPopState = (): void => {
    setConsoleMode(isConsolePath(window.location.pathname));
  };
  window.addEventListener('popstate', onPopState);
  onCleanup(() => window.removeEventListener('popstate', onPopState));
  return (
    <Show when={consoleMode()} fallback={<AppBoot />}>
      <ConsoleBoot />
    </Show>
  );
}

if (!redirectedToConsole()) {
  render(() => <Boot />, root);
}
