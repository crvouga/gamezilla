import { expect, test } from 'bun:test';
import type { Device } from '../src/live-browser';
import {
  type LiveDevices,
  navigateLiveDevice,
} from '../src/live-journey-devices';

// regression: live-device-reopen-returns-before-new-document
test('reopening a device returns only after the new page replaced the old one', async () => {
  // launch() resolves while the old page is still shown; the reload commits
  // a few polls later and only then can boot cover the header.
  let page: Record<string, unknown> = {};
  let pollsUntilCommit = -1;
  const view = {
    cdp: async () => ({}),
    navigate: async () => undefined,
    screenshot: async () => Buffer.alloc(0),
    evaluate: async (script: string) => {
      if (pollsUntilCommit > 0 && --pollsUntilCommit === 0) page = {};
      const assign = script.match(/^globalThis\.(\w+) = (.+)$/);
      if (assign) {
        page[assign[1] as string] = JSON.parse(assign[2] as string);
        return undefined;
      }
      return page[script.replace('globalThis.', '')];
    },
  } as unknown as Device['view'];
  const device = {
    apiOrigin: 'https://api.example',
    view,
    driver: {
      launch: async () => {
        pollsUntilCommit = 3;
      },
    },
    console: [],
    network: [],
    close: async () => undefined,
  } as unknown as Device;
  const devices: LiveDevices = {
    host: device,
    guest: null,
    shown: null,
    previousPeers: [],
  };
  await navigateLiveDevice(devices, device);
  expect(pollsUntilCommit).toBe(0);
});
