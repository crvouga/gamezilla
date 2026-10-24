import { expect, test } from 'bun:test';
import type {
  JourneyGestures,
  JourneyHost,
} from '@libs/runtime-harness-ts/journey-types';
import { authorNumberlinkJourney } from '@libs/runtime-harness-ts/numberlink-authoring-journey';
import { cleanupDriver } from './content-cleanup-driver';

// regression: numberlink-publication-cleanup-reloads-library
test('publication cleanup withdraws from the current library without reloading its space', async () => {
  const cleanups = new Map<string, JourneyGestures>();
  const unused = (): never => {
    throw new Error('Unexpected page navigation');
  };
  let online = false;
  const host: JourneyHost = {
    runId: 'cleanup-regression',
    now: unused,
    browser: null,
    showsPuzzleAnswers: false,
    open: async () => {},
    openPeer: unused,
    peerDevice: {
      spaceLink: unused,
      reopen: unused,
      offline: unused,
      online: unused,
      anotherSignedInDevice: unused,
    },
    act: async () => {
      throw new Error('Stop after cleanup registration');
    },
    actAsGuest: unused,
    spaceLink: unused,
    openLink: unused,
    openGuest: unused,
    offline: unused,
    online: async () => {
      online = true;
    },
    reopen: unused,
    defer: (key, cleanup) => {
      cleanups.set(key, cleanup);
    },
    settle: unused,
  };
  // Existing ownership is the cleanup input; stop before creating new work.
  await expect(
    authorNumberlinkJourney(host, 'anonymous', ['river-document'])
  ).rejects.toThrow('Stop after cleanup registration');
  const cleanup = cleanups.get('numberlink-publications');
  expect(cleanup).toBeDefined();
  if (cleanup === undefined) throw new Error('Missing publication cleanup');
  const device = cleanupDriver();
  await cleanup(device.ui);
  expect(online).toBe(true);
  expect(device.withdrawn()).toBe(true);
});
