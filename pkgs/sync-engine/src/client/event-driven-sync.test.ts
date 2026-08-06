import {
  createInMemoryPubSub,
  type InMemoryPubSub,
} from '@pkgs/pubsub/testing';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { z } from 'zod';

import { defineMutation } from '../mutations/core/define-mutation';
import { defineQuery } from '../queries/core/define-query';
import { queryRegistry } from '../queries/core/registry';
import { openScenarioDb } from '../queries/test/scenario-fixture';
import {
  assertChannelExhaustiveness,
  findChannelExhaustivenessGaps,
} from '../shared/channel-exhaustiveness';
import { createControllableLifecycle } from './app-lifecycle';
import { attachNudges } from './attach-nudges';
import { SubscriptionRuntime } from './subscription-runtime';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(
  pred: () => boolean,
  timeoutMs: number
): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start >= timeoutMs) return;
    await sleep(10);
  }
}

function stubMergeDeps(db: Awaited<ReturnType<typeof openScenarioDb>>) {
  return {
    db,
    registry: {},
    env: {
      actorId: 'actor1',
      deviceId: 'd1',
      accountId: null as string | null,
      isAnon: true,
      now: () => new Date(),
    },
    bus: { emit: () => undefined, subscribe: () => () => undefined },
    clientId: 'c1',
  };
}

function makeQueries(count: number) {
  return Array.from({ length: count }, (_, i) =>
    defineQuery({
      name: `q${String(i)}`,
      params: z.object({}),
      hydrates: ['notes'],
      limit: 10,
      channels: (_p, ctx) => [`user:${ctx.actorId}`],
      async run() {
        return { notes: [] };
      },
    })
  );
}

function resolveHarnessOpts(opts?: {
  readonly fallbackPollMs?: number;
  readonly reconcileMs?: number;
  readonly foreground?: boolean;
  readonly connectedMode?: boolean;
  readonly subscriptionCount?: number;
}) {
  return {
    fallbackPollMs: opts?.fallbackPollMs ?? 60_000,
    reconcileMs: opts?.reconcileMs ?? 600_000,
    foreground: opts?.foreground ?? true,
    connectedMode: opts?.connectedMode !== false,
    subscriptionCount: opts?.subscriptionCount ?? 5,
  };
}

describe('event-driven-sync', () => {
  const disposers: Array<() => void> = [];
  afterEach(() => {
    for (const d of disposers.splice(0)) d();
  });

  async function harness(opts?: Parameters<typeof resolveHarnessOpts>[0]) {
    const cfg = resolveHarnessOpts(opts);
    const db = await openScenarioDb();
    const postQuery = mock(async () => ({ status: 'not_modified' as const }));
    const queries = makeQueries(cfg.subscriptionCount);
    const registry = queryRegistry(queries);
    const { lifecycle, setForeground, setOnline } = createControllableLifecycle(
      {
        foreground: cfg.foreground,
      }
    );
    const runtime = new SubscriptionRuntime({
      db,
      boot: queries.map((q) => ({ name: q.name, params: {} })),
      postQuery,
      getMergeDeps: () => stubMergeDeps(db),
      onError: () => undefined,
      onSynced: () => undefined,
      lifecycle,
      fallbackPollMs: cfg.fallbackPollMs,
      reconcileMs: cfg.reconcileMs,
      random: () => 0,
    });
    runtime.start();
    if (cfg.connectedMode) runtime.setConnectedMode(true);
    await runtime.waitForBoot();
    postQuery.mockClear();
    disposers.push(() => runtime.stop());
    return { runtime, postQuery, setForeground, setOnline, registry, db };
  }

  test('no-timer-queries-when-connected', async () => {
    const { postQuery } = await harness({ subscriptionCount: 5 });
    await sleep(80);
    expect(postQuery.mock.calls.length).toBe(0);
  });

  test('nudge-is-sole-fast-path', async () => {
    const { runtime, postQuery, registry, db } = await harness({
      subscriptionCount: 1,
    });
    const pubsub = createInMemoryPubSub() as InMemoryPubSub;
    disposers.push(
      attachNudges({
        pubsub,
        runtime,
        queryRegistry: registry,
        mutationRegistry: {},
        bus: { emit: () => undefined, subscribe: () => () => undefined },
        db,
        getChannelsCtx: () => ({ actorId: 'actor1' }),
        remakePubSub: () => createInMemoryPubSub() as InMemoryPubSub,
        debounceMs: 20,
      })
    );
    await sleep(5);
    postQuery.mockClear();
    await pubsub.publish('user:actor1', {});
    await sleep(40);
    expect(postQuery.mock.calls.length).toBe(1);
    await sleep(60);
    expect(postQuery.mock.calls.length).toBe(1);
  });

  test('foreground-triggers-jittered-sweep', async () => {
    const { postQuery, setForeground } = await harness({
      subscriptionCount: 3,
    });
    setForeground(false);
    postQuery.mockClear();
    setForeground(true);
    await sleep(20);
    expect(postQuery.mock.calls.length).toBe(3);
  });

  test('down-state-shared-slow-fallback', async () => {
    const { postQuery, runtime } = await harness({
      connectedMode: false,
      fallbackPollMs: 50,
      subscriptionCount: 3,
      reconcileMs: 600_000,
    });
    runtime.setConnectedMode(false);
    await sleep(10);
    postQuery.mockClear();
    await sleep(60);
    expect(postQuery.mock.calls.length).toBe(3);
    await sleep(60);
    expect(postQuery.mock.calls.length).toBe(6);
  });

  test('background-silence', async () => {
    const { postQuery, setForeground, runtime, registry, db } = await harness({
      subscriptionCount: 2,
      connectedMode: false,
      fallbackPollMs: 30,
    });
    setForeground(false);
    postQuery.mockClear();
    disposers.push(
      attachNudges({
        pubsub: createInMemoryPubSub() as InMemoryPubSub,
        runtime,
        queryRegistry: registry,
        mutationRegistry: {},
        bus: { emit: () => undefined, subscribe: () => () => undefined },
        db,
        getChannelsCtx: () => ({ actorId: 'actor1' }),
        remakePubSub: () => createInMemoryPubSub() as InMemoryPubSub,
        debounceMs: 10,
      })
    );
    await sleep(80);
    expect(postQuery.mock.calls.length).toBe(0);
  });

  test('reconciliation-tick-runs-and-detects', async () => {
    const db = await openScenarioDb();
    let call = 0;
    const postQuery = mock(async () => {
      call += 1;
      if (call === 1) {
        return {
          status: 'ok' as const,
          mode: 'full' as const,
          checkpoint: '1',
          hash: 'h1',
          tables: { notes: [] },
        };
      }
      return {
        status: 'ok' as const,
        mode: 'full' as const,
        checkpoint: '2',
        hash: 'h2',
        tables: { notes: [{ id: 'n1' }] },
      };
    });
    const missed: Array<{ scope: string; name: string }> = [];
    const { lifecycle } = createControllableLifecycle();
    const runtime = new SubscriptionRuntime({
      db,
      boot: [{ name: 'detectMe', params: {} }],
      postQuery,
      getMergeDeps: () => stubMergeDeps(db),
      onError: () => undefined,
      onSynced: () => undefined,
      lifecycle,
      reconcileMs: 40,
      fallbackPollMs: 600_000,
      random: () => 0,
      onMissedEvent: (info) => missed.push(info),
    });
    runtime.start();
    runtime.setConnectedMode(true);
    await runtime.waitForBoot();
    postQuery.mockClear();
    missed.length = 0;
    // Re-arm from a known point; skip-if-recent may defer one tick under load.
    runtime.setConnectedMode(true);
    await waitUntil(
      () => postQuery.mock.calls.length >= 1 && missed.length >= 1,
      1_000
    );
    expect(postQuery.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(missed.length).toBeGreaterThanOrEqual(1);
    expect(missed[0]?.name).toBe('detectMe');
    runtime.stop();
  });
});

describe('channel-exhaustiveness', () => {
  test('exhaustiveness-check-fails-on-unwired-pair', () => {
    const mutation = defineMutation({
      name: 'writeNotes',
      args: z.object({}),
      writes: ['notes'],
      async run() {
        return;
      },
    });
    const query = defineQuery({
      name: 'readNotes',
      params: z.object({}),
      hydrates: ['notes'],
      limit: 10,
      channels: (_p, ctx) => [`user:${ctx.actorId}`],
      async run() {
        return { notes: [] };
      },
    });
    const gaps = findChannelExhaustivenessGaps([mutation], [query]);
    expect(gaps).toEqual([
      { mutation: 'writeNotes', query: 'readNotes', tables: ['notes'] },
    ]);
    expect(() => assertChannelExhaustiveness([mutation], [query])).toThrow(
      /writeNotes → readNotes/
    );
  });

  test('exhaustiveness-check-passes-when-wired', () => {
    const mutation = defineMutation({
      name: 'writeNotes',
      args: z.object({}),
      writes: ['notes'],
      invalidates: (_a, env) => [`user:${env.actorId}`],
      async run() {
        return;
      },
    });
    const query = defineQuery({
      name: 'readNotes',
      params: z.object({}),
      hydrates: ['notes'],
      limit: 10,
      channels: (_p, ctx) => [`user:${ctx.actorId}`],
      async run() {
        return { notes: [] };
      },
    });
    expect(() =>
      assertChannelExhaustiveness([mutation], [query])
    ).not.toThrow();
  });
});
