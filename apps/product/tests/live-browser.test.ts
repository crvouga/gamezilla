import { expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';
import {
  emulateOffline,
  openDevice,
  waitForCachedShell,
} from '@apps/product/live-browser';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';

// regression: health-macos-offline-network
// regression: health-offline-existing-room-socket
test('a fresh live device can cut its network through Chrome', async () => {
  const commands: { method: string; params: unknown }[] = [];
  let closed = false;
  const device = await openDevice(
    { webOrigin: 'https://web.example', apiOrigin: 'https://api.example' },
    (options) => {
      const backend = options.backend ?? 'webkit';
      return {
        navigate: async () => {},
        evaluate: async () => 'active',
        cdp: async (method: string, params: unknown) => {
          if (backend !== 'chrome') throw new Error('WebKit has no CDP');
          commands.push({ method, params });
        },
        close: () => {
          closed = true;
        },
      } as unknown as Bun.WebView;
    }
  );
  try {
    await emulateOffline(device.view);
    expect(commands).toEqual([
      { method: 'Network.enable', params: undefined },
      {
        method: 'Storage.clearDataForOrigin',
        params: { origin: 'https://web.example', storageTypes: 'all' },
      },
      {
        method: 'Storage.clearDataForOrigin',
        params: { origin: 'https://api.example', storageTypes: 'all' },
      },
      {
        method: 'Network.emulateNetworkConditions',
        params: {
          offline: true,
          latency: 0,
          downloadThroughput: 0,
          uploadThroughput: 0,
        },
      },
    ]);
  } finally {
    await device.close();
  }
  expect(closed).toBe(true);
});

// regression: health-offline-before-precache-ready
test('a cold install taking more than twenty seconds stays online until ready', async () => {
  const { clock, timers } = createHarnessClock();
  const ready = new Promise((resolve) => {
    timers.setTimeout(() => resolve({ active: {} }), 25_000);
  });
  const view = {
    evaluate: (script: string) =>
      runInNewContext(script, {
        navigator: { serviceWorker: { ready } },
      }),
  } as unknown as Bun.WebView;
  let settled = false;
  const waiting = waitForCachedShell(view).then(() => {
    settled = true;
  });
  clock.advance(20_000);
  await Promise.resolve();
  expect(settled).toBe(false);
  clock.advance(5_000);
  await waiting;
  expect(settled).toBe(true);
});

test('an unavailable offline shell fails the readiness check', async () => {
  const view = {
    evaluate: (script: string) => runInNewContext(script, { navigator: {} }),
  } as unknown as Bun.WebView;
  await expect(waitForCachedShell(view)).rejects.toThrow(
    'no service worker support'
  );
});
