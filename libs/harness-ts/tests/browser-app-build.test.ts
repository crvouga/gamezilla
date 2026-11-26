import { expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';
import type { ActorBrowserStorage } from '@libs/harness-ts/actor-browser-storage';
import { createHarnessAppBuilds } from '@libs/harness-ts/app-build';
import type { Harness } from '@libs/harness-ts/create-harness';
import { launchActor } from '@libs/harness-ts/launch-actor';
import {
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from '@pkgs/sync-engine-shared-ts/v2';

type Page = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

/**
 * A browser device whose page sends its own requests, as one on the stack
 * does: what reaches the server is whatever the page's fetch sends.
 */
function browserDevice() {
  const sent: string[] = [];
  const openDocument = (): Page => ({
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      sent.push(`${String(input)} ${headers.get(SYNC_PROTOCOL_HEADER)}`);
      return Promise.resolve(new Response(null, { status: 204 }));
    },
  });
  let page = openDocument();
  const view = {
    navigate: () => {
      page = openDocument();
      return Promise.resolve();
    },
    // A page script runs in the page's own realm and closes over nothing.
    evaluate: (script: string) =>
      Promise.resolve(
        script.includes('__harnessAppBuild')
          ? runInNewContext(script, { window: page, Headers, Request })
          : null
      ),
  };
  const storage = {
    dataStore: { directory: '/devices/alice' },
    browser: {
      open: () =>
        Promise.resolve({
          view,
          driver: { launch: () => Promise.resolve() },
          close: () => Promise.resolve(),
        }),
    },
  } as unknown as ActorBrowserStorage;
  /** What the app's sync client sends: its protocol on every sync call. */
  const sync = () =>
    page.fetch('https://api.test/sync/pull', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL_VERSION),
      },
      body: '{}',
    });
  const other = () => page.fetch('https://api.test/api/health');
  return { sent, storage, sync, other };
}

// regression: browser-outdated-app-build-ignored
test('a browser device on an outdated build speaks the outdated protocol from its own page', async () => {
  const device = browserDevice();
  const appBuilds = createHarnessAppBuilds();
  const { handle, closeResources } = await launchActor({
    ui: { kind: 'bun-webview', webOrigin: 'https://web.test' },
    id: 'alice',
    harness: { appBuilds } as unknown as Harness,
    browserStorage: device.storage,
  });
  const current = String(SYNC_PROTOCOL_VERSION);
  const outdated = String(SYNC_PROTOCOL_VERSION - 1);
  await device.sync();
  await appBuilds.set('alice', 'outdated');
  await device.sync();
  await device.other();
  await appBuilds.set('bob', 'current');
  await handle.openLink('/spaces');
  await device.sync();
  await appBuilds.set('alice', 'current');
  await device.sync();
  await closeResources();
  await appBuilds.set('alice', 'outdated');
  expect(device.sent).toEqual([
    `https://api.test/sync/pull ${current}`,
    `https://api.test/sync/pull ${outdated}`,
    'https://api.test/api/health null',
    `https://api.test/sync/pull ${outdated}`,
    `https://api.test/sync/pull ${current}`,
  ]);
});

test('a browser device reopened on an outdated build speaks the outdated protocol', async () => {
  const device = browserDevice();
  const appBuilds = createHarnessAppBuilds();
  await appBuilds.set('alice', 'outdated');
  await launchActor({
    ui: { kind: 'bun-webview', webOrigin: 'https://web.test' },
    id: 'alice',
    harness: { appBuilds } as unknown as Harness,
    browserStorage: device.storage,
  });
  await device.sync();
  expect(device.sent).toEqual([
    `https://api.test/sync/pull ${SYNC_PROTOCOL_VERSION - 1}`,
  ]);
});
