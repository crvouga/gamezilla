import { expect, test } from 'bun:test';
import { emulateOffline, openDevice } from '@apps/product/harness/live-browser';

// regression: health-macos-offline-network
test('a fresh live device can cut its network through Chrome', async () => {
  const commands: { method: string; params: unknown }[] = [];
  let closed = false;
  const device = await openDevice(
    { webOrigin: 'https://web.example', apiOrigin: 'https://api.example' },
    (options) => {
      const backend = options.backend ?? 'webkit';
      return {
        navigate: async () => {},
        evaluate: async () => 'none',
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
      {
        method: 'Storage.clearDataForOrigin',
        params: { origin: 'https://web.example', storageTypes: 'all' },
      },
      {
        method: 'Storage.clearDataForOrigin',
        params: { origin: 'https://api.example', storageTypes: 'all' },
      },
      { method: 'Network.enable', params: undefined },
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
