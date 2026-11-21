import { expect, test } from 'bun:test';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { APP_SYSTEM } from '@libs/runtime-harness-ts/app-composition';
import { MAX_SNAPSHOT_BYTES } from '@pkgs/feedback-shared-ts/bug-report';
import type { HarnessCheckpoint } from '@pkgs/harness-console-shared-ts/checkpoint';
import { createProductHarnessLogBuffer } from '@pkgs/harness-console-shared-ts/product-harness-log-buffer';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import {
  bugReportToReopen,
  fetchReportedWorld,
  harnessContext,
  harnessSnapshotPort,
  searchAfterReopening,
} from '../src/harness-bug-reports';
import { seedFriends } from '../src/product-harness-friends-seed';
import { buildProductHarnessSession } from '../src/product-harness-session';
import { decodeHarnessWorld } from '../src/product-harness-world';

const REPORT = '11111111-1111-4111-8111-111111111111';

async function openSession(
  reportedWorld?: () => Promise<HarnessCheckpoint | null>
) {
  const run = await APP_SYSTEM.run({ seed: 1, runtime: 'in-process' });
  let surface: ProductHarness | null = null;
  await run.apply(
    defineAction({
      name: 'harnessBugReportsTest.pin',
      report: false,
      act: (s: ProductHarness) => {
        surface = s;
      },
    })
  );
  const harness = (surface as unknown as ProductHarness).harness;
  let paused = false;
  const session = await buildProductHarnessSession({
    harness,
    balancerLogs: createProductHarnessLogBuffer(),
    pubsubLogs: createProductHarnessLogBuffer(),
    roomLogs: createProductHarnessLogBuffer(),
    snapshotStore: new ObjectStoreImplInMemory(),
    emulatorDashboardUrl: () => null,
    disposeTick: () => undefined,
    getClockPaused: () => paused,
    setClockPaused: (next) => {
      paused = next;
    },
    seedFreshWorld: () => seedFriends(harness, async () => undefined),
    ...(reportedWorld ? { reportedWorld } : {}),
    breathe: async () => undefined,
  });
  return {
    session,
    async [Symbol.asyncDispose]() {
      await session.dispose();
      await run[Symbol.asyncDispose]();
    },
  };
}

test('a bug report from the harness carries its world, which a new harness opens on', async () => {
  let bytes = new Uint8Array();
  {
    await using reported = await openSession();
    await reported.session.addClient('carol');
    const sessions = { current: reported.session };
    const search = () => '?show=client%3Abob&bug-report=x';
    const file = await harnessSnapshotPort({ sessions, search }).capture();
    expect(file?.contentType).toBe('application/gzip');
    bytes = file?.bytes ?? bytes;
  }
  expect(bytes.byteLength).toBeGreaterThan(0);
  expect(bytes.byteLength).toBeLessThan(MAX_SNAPSHOT_BYTES);
  const world = await decodeHarnessWorld(bytes);
  expect(world?.search).toBe('?show=client%3Abob');

  await using reopened = await openSession(async () => world?.checkpoint ?? null);
  expect([...reopened.session.clients.keys()]).toEqual([
    'alice',
    'bob',
    'carol',
  ]);
  expect(reopened.session.clock.now()).toBe(world?.checkpoint.clockMs ?? -1);
});

test('a world that cannot be had opens the harness as it would have', async () => {
  await using opened = await openSession(async () => {
    throw new Error('archive unreachable');
  });
  expect([...opened.session.clients.keys()]).toEqual(['alice', 'bob']);
});

test('a bug report names the client on show and where its app is, never a query', async () => {
  await using opened = await openSession();
  const bob = opened.session.clients.get('bob')?.view;
  if (bob?.kind === 'solid')
    bob.history.set({ value: '/people?q=secret#top', replace: true });
  const context = harnessContext({
    sessions: { current: opened.session },
    search: () => '?show=client%3Abob',
    preview: () => ({ preview: 'pr-391', commit: 'abc1234' }),
  });
  expect(await context.collect(new AbortController().signal)).toMatchObject({
    preview: { preview: 'pr-391', commit: 'abc1234' },
    shown: 'client:bob',
    client: 'bob',
    clientPath: '/people',
    clients: ['alice', 'bob'],
  });
  const first = harnessContext({
    sessions: { current: opened.session },
    search: () => '',
    preview: () => null,
  });
  expect(await first.collect(new AbortController().signal)).toMatchObject({
    shown: 'client:alice',
    client: 'alice',
  });
});

test('only a bug report id asks to reopen a world, and reopening shows what the reporter had on show', () => {
  expect(bugReportToReopen(`?bug-report=${REPORT}`)).toBe(REPORT);
  expect(bugReportToReopen('?bug-report=../../limits')).toBeNull();
  expect(bugReportToReopen('?show=lb')).toBeNull();
  expect(
    searchAfterReopening(`?bug-report=${REPORT}&show=lb&theme=dark`, {
      search: '?show=client%3Abob',
      checkpoint: {} as HarnessCheckpoint,
    })
  ).toBe('?theme=dark&show=client%3Abob');
});

test('a world the archive does not hold reads back as none', async () => {
  const asked: string[] = [];
  const world = await fetchReportedWorld({
    http: {
      fetch: async (input) => {
        asked.push(String(input));
        return new Response('Not found', { status: 404 });
      },
    },
    endpoint: 'https://api.example/api/bug-reports',
    id: REPORT,
  });
  expect(world).toBeNull();
  expect(asked).toEqual([
    `https://api.example/api/bug-reports/reports/${REPORT}/snapshot`,
  ]);
});
