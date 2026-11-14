import { expect, test } from 'bun:test';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { APP_SYSTEM } from '@libs/runtime-harness-ts/app-composition';
import { HARNESS_SERVER_URL } from '@libs/sub-shared-ts/harness-constants';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import {
  NOTIFICATIONS_EMULATOR_ID,
  notifyingEmulators,
  sessionEmulators,
} from '../src/notifications-emulator';
import {
  addProductHarnessServer,
  refreshProductHarnessServers,
  removeProductHarnessServer,
} from '../src/product-harness-session-servers';
import type { SessionMaps } from '../src/product-harness-session-teardown';

function sessionMaps(): SessionMaps {
  return {
    clients: new Map(),
    lives: new Map(),
    servers: new Map(),
    serverLogs: new Map(),
    rooms: new Map(),
    listeners: new Set(),
    revision: 0,
    snapshotEpoch: 0,
    snapshotRestoring: false,
    quietDepth: 0,
    domainWakeListeners: new Set(),
  };
}

test('with every server removed a request fails as one to a missing server, until one is added', async () => {
  await using run = await APP_SYSTEM.run({ seed: 1, runtime: 'in-process' });
  let surface: ProductHarness | null = null;
  await run.apply(
    defineAction({
      name: 'emptyFleetTest.pin',
      report: false,
      act: (s: ProductHarness) => {
        surface = s;
      },
    })
  );
  const harness = (surface as unknown as ProductHarness).harness;
  const maps = sessionMaps();
  refreshProductHarnessServers(harness, maps);
  const health = () =>
    harness.loadBalancer.fetchFrom('alice')(`${HARNESS_SERVER_URL}/api/health`);
  expect((await health()).status).toBe(200);

  for (const id of [...maps.servers.keys()])
    await removeProductHarnessServer(harness, maps, id);
  expect([...maps.servers.keys()]).toEqual([]);
  expect(harness.serverIds()).toEqual([]);
  expect(harness.loadBalancer.inspect().backends).toEqual([]);
  // Nothing answers: the request is refused, not served by a leftover.
  const rejectedBefore = harness.loadBalancer.inspect().rejected;
  await expect(health()).rejects.toThrow();
  expect(harness.loadBalancer.inspect().rejected).toBe(rejectedBefore + 1);

  const added = await addProductHarnessServer(harness, maps);
  expect([...maps.servers.keys()]).toEqual([added.id]);
  expect((await health()).status).toBe(200);
});

test('the notification screens are listed after the vendors, where the page can open them', () => {
  const vendor = {
    id: 'google',
    title: 'Google sign-in',
    origin: 'http://google.local',
    fetch: async () => new Response(null),
  };
  const harness = { emulators: () => [vendor] };
  const emulatorDashboardUrl = (id: string) => `/__emulators/page/${id}/ui`;
  expect(sessionEmulators({ harness, emulatorDashboardUrl })).toEqual([
    {
      id: 'google',
      title: 'Google sign-in',
      dashboardUrl: '/__emulators/page/google/ui',
    },
  ]);
  const open = () => ({ element: {} as Node, dispose: () => undefined });
  const listed = sessionEmulators({
    harness,
    emulatorDashboardUrl,
    openNotifications: open,
  });
  expect(listed.map((emulator) => emulator.id)).toEqual([
    'google',
    NOTIFICATIONS_EMULATOR_ID,
  ]);
  expect(listed[1]).toMatchObject({ dashboardUrl: null, open });
});

test('the notification screens read the vendors that deliver to a person, and no other', () => {
  const emulator = (id: string) => ({
    id,
    title: id,
    origin: `http://${id}.local`,
    fetch: async () => new Response(id),
  });
  const read = notifyingEmulators(
    ['google', 'stripe', 'resend', 's3', 'twilio'].map(emulator)
  );
  expect(Object.keys(read)).toEqual(['resend', 'twilio']);
  expect(read['twilio']?.service).toBe('twilio');
});
