import { expect, test } from 'bun:test';
import {
  browserFailureLog,
  captureBrowserStorageEvidence,
  readBrowserStorageEvidence,
} from '@apps/product-ts/browser-failure-summary';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';

const ACCOUNT = 'a63ba7ed-145a-4b8c-8161-eed141a55334';
const DEVICE = 'd0228b57-28c8-4971-93cd-a3e70f62ab83';

// regression: offline-space-failure-missing-storage-evidence
test('offline failure evidence retains bounded identity and database names without authentication secrets', async () => {
  const { clock, timers } = createHarnessClock();
  const readKeys: string[] = [];
  const stored: Record<string, string> = {
    lastLocalAccountId: ACCOUNT,
    deviceId: DEVICE,
    sessionToken: 'secret-bearer',
    unrelated: 'private-value',
  };
  const result = await captureBrowserStorageEvidence({
    pathname: `/space/${'x'.repeat(300)}`,
    readIdentity: (key) => {
      readKeys.push(key);
      return stored[key] ?? null;
    },
    directories: async () =>
      (async function* () {
        yield ['secret-bearer', { kind: 'directory' }] as const;
        for (let index = 0; index < 20; index++)
          yield [
            `user_${index.toString(16).padStart(12, '0')}`,
            { kind: 'directory' },
          ] as const;
      })(),
    timers,
  });
  const state = JSON.parse(result);
  expect(state).toMatchObject({
    pathname: `/space/${'x'.repeat(249)}`,
    accountId: ACCOUNT,
    deviceId: DEVICE,
    opfs: 'available',
  });
  expect(state).toHaveProperty(
    'databases',
    Array.from(
      { length: 8 },
      (_, index) => `user_${index.toString(16).padStart(12, '0')}`
    )
  );
  expect(readKeys).toEqual(['lastLocalAccountId', 'deviceId']);
  expect(result).not.toContain('secret-bearer');
  expect(result).not.toContain('private-value');
  expect(result.length).toBeLessThan(1_000);
  expect(clock.pendingOneShotCount()).toBe(0);
});

test('unavailable or stalled browser storage cannot mask the original failure', async () => {
  const { clock, timers } = createHarnessClock();
  const unavailable = await captureBrowserStorageEvidence({
    pathname: '/space/one',
    readIdentity: () => {
      throw new Error('secret-token');
    },
    directories: async () => {
      throw new Error('secret-token');
    },
    timers,
  });
  expect(JSON.parse(unavailable)).toEqual({
    pathname: '/space/one',
    accountId: null,
    deviceId: null,
    databases: [],
    opfs: 'unavailable',
  });
  const stalled = captureBrowserStorageEvidence({
    pathname: '/',
    readIdentity: () => 'not-an-id-secret',
    directories: () => new Promise(() => {}),
    timers,
  });
  clock.advance(1_000);
  expect(JSON.parse(await stalled)).toMatchObject({
    accountId: null,
    deviceId: null,
    opfs: 'timeout',
  });
  const parked = readBrowserStorageEvidence(
    () => new Promise(() => {}),
    timers
  );
  clock.advance(1_500);
  expect(await parked).toBe('timeout');
  expect(
    await readBrowserStorageEvidence(async () => {
      throw new Error('secret-token');
    }, timers)
  ).toBe('unavailable');
  expect(clock.pendingOneShotCount()).toBe(0);
});

// regression: journey-failure-screen-truncated
// Shard 42 lost the host's Numberlink screen behind two transport dumps.
test('a bounded CI log tail retains both device screens after transport evidence', () => {
  const host = 'browser failure state (host): content-author';
  const peer = 'browser failure state (peer): puzzle-content-edition';
  const transport = Array.from(
    { length: 120 },
    (_, index) => `request ${index}: ${'SQL evidence '.repeat(100)}`
  ).join('\n');
  const log = browserFailureLog([transport, transport], [host, peer]);
  const retained = log.slice(-2000);
  expect(retained).toContain(host);
  expect(retained).toContain(peer);
  expect(log).toContain(transport);
});
