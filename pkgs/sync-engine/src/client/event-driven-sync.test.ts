import { afterEach, describe, expect, mock, test } from 'bun:test';
import {
  createInMemoryPubSub,
  type InMemoryPubSub,
} from '@pkgs/pubsub/testing';
import { z } from 'zod';

import { defineMutation } from '../mutations/core/define-mutation';
import { defineQuery } from '../queries/core/define-query';
import { queryRegistry } from '../queries/core/registry';
import { openScenarioDb } from '../queries/test/scenario-fixture';
import {
  assertChannelExhaustiveness,
  findChannelExhaustivenessGaps,
} from '../shared/channel-exhaustiveness';
import { createSimTestDriver } from '../sim/test-driver';
import { createControllableLifecycle } from './app-lifecycle';
import { attachNudges } from './attach-nudges';
import { SubscriptionRuntime } from './subscription-runtime';

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

describe('event-driven-sync', () => {
  const disposers: Array<() => void> = [];
  afterEach(() => {
    for (const d of disposers.splice(0)) d();
  });

  async function harness(opts?: {
    readonly foreground?: boolean;
    readonly subscriptionCount?: number;
  }) {
    const subscriptionCount = opts?.subscriptionCount ?? 5;
    const foreground = opts?.foreground ?? true;
    const sim = createSimTestDriver();
    const db = await openScenarioDb();
    const postQueries = mock(async (requests: readonly unknown[]) =>
      requests.map(() => ({ status: 'not_modified' as const }))
    );
    const queries = makeQueries(subscriptionCount);
    const registry = queryRegistry(queries);
    const { lifecycle, setForeground, setOnline } = createControllableLifecycle(
      {
        foreground,
      }
    );
    const runtime = new SubscriptionRuntime({
      db,
      postQueries,
      getMergeDeps: () => stubMergeDeps(db),
      onError: () => undefined,
      onSynced: () => undefined,
      lifecycle,
      timers: sim.timers,
    });
    const subscriptions = queries.map((query) =>
      runtime.subscribe({ name: query.name, params: {} })
    );
    runtime.start();
    await Promise.all(subscriptions.map((sub) => sub.waitForFirstSync()));
    postQueries.mockClear();
    disposers.push(() => runtime.stop());
    return {
      runtime,
      postQueries,
      setForeground,
      setOnline,
      registry,
      db,
      sim,
    };
  }

  test('session queries coalesce into one batch', async () => {
    const sim = createSimTestDriver();
    const db = await openScenarioDb();
    const postQueries = mock(async (requests: readonly unknown[]) =>
      requests.map(() => ({ status: 'not_modified' as const }))
    );
    const queries = makeQueries(5);
    const runtime = new SubscriptionRuntime({
      db,
      postQueries,
      getMergeDeps: () => stubMergeDeps(db),
      onError: () => undefined,
      onSynced: () => undefined,
      timers: sim.timers,
    });
    const subscriptions = queries.map((query) =>
      runtime.subscribe({ name: query.name, params: {} })
    );
    runtime.start();
    await Promise.all(subscriptions.map((sub) => sub.waitForFirstSync()));
    expect(postQueries.mock.calls.length).toBe(1);
    expect((postQueries.mock.calls[0]?.[0] as readonly unknown[]).length).toBe(
      5
    );
    runtime.stop();
  });

  test('subscribe coalesces with pending session queries', async () => {
    const sim = createSimTestDriver();
    const db = await openScenarioDb();
    const postQueries = mock(async (requests: readonly unknown[]) =>
      requests.map(() => ({ status: 'not_modified' as const }))
    );
    const queries = makeQueries(2);
    const runtime = new SubscriptionRuntime({
      db,
      postQueries,
      getMergeDeps: () => stubMergeDeps(db),
      onError: () => undefined,
      onSynced: () => undefined,
      timers: sim.timers,
    });
    const first = runtime.subscribe({ name: queries[0]!.name, params: {} });
    runtime.start();
    const second = runtime.subscribe({ name: queries[1]!.name, params: {} });
    await Promise.all([first.waitForFirstSync(), second.waitForFirstSync()]);
    await Promise.resolve();
    expect(postQueries.mock.calls.length).toBe(1);
    expect((postQueries.mock.calls[0]?.[0] as readonly unknown[]).length).toBe(
      2
    );
    runtime.stop();
  });

  test('no-timer-queries-when-idle', async () => {
    const { postQueries, sim } = await harness({ subscriptionCount: 5 });
    await sim.runFor(80);
    expect(postQueries.mock.calls.length).toBe(0);
  });

  test('nudge-is-sole-fast-path', async () => {
    const { runtime, postQueries, registry, sim, db } = await harness({
      subscriptionCount: 1,
    });
    const pubsub = createInMemoryPubSub() as InMemoryPubSub;
    let activePubSub = pubsub;
    disposers.push(
      attachNudges({
        pubsub,
        runtime,
        queryRegistry: registry,
        getChannelsCtx: () => ({ actorId: 'actor1' }),
        db,
        remakePubSub: () => {
          activePubSub = createInMemoryPubSub() as InMemoryPubSub;
          return activePubSub;
        },
        timers: sim.timers,
      })
    );
    await sim.runFor(5);
    postQueries.mockClear();
    await activePubSub.publish('user:actor1', { checkpoint: '1' });
    await sim.runFor(40);
    expect(postQueries.mock.calls.length).toBe(1);
    await sim.runFor(60);
    expect(postQueries.mock.calls.length).toBe(1);
  });

  test('foreground-does-not-sweep', async () => {
    const { postQueries, setForeground, sim } = await harness({
      subscriptionCount: 3,
    });
    setForeground(false);
    postQueries.mockClear();
    setForeground(true);
    await sim.runFor(20);
    expect(postQueries.mock.calls.length).toBe(0);
  });

  test('idle-without-pubsub-stays-quiet', async () => {
    const { postQueries, sim } = await harness({
      subscriptionCount: 3,
    });
    await sim.runFor(10);
    postQueries.mockClear();
    await sim.runFor(120);
    expect(postQueries.mock.calls.length).toBe(0);
  });

  test('background-silence', async () => {
    const { postQueries, setForeground, runtime, registry, sim, db } =
      await harness({
        subscriptionCount: 2,
      });
    setForeground(false);
    postQueries.mockClear();
    disposers.push(
      attachNudges({
        pubsub: createInMemoryPubSub() as InMemoryPubSub,
        runtime,
        queryRegistry: registry,
        getChannelsCtx: () => ({ actorId: 'actor1' }),
        db,
        remakePubSub: () => createInMemoryPubSub() as InMemoryPubSub,
        timers: sim.timers,
      })
    );
    await sim.runFor(80);
    expect(postQueries.mock.calls.length).toBe(0);
  });

  test('re-subscribe-skips-network-when-firstDone', async () => {
    const { runtime, postQueries, sim } = await harness({
      subscriptionCount: 1,
    });
    const name = 'q0';
    const first = runtime.subscribe({ name, params: {} });
    await first.waitForFirstSync();
    postQueries.mockClear();
    const second = runtime.subscribe({ name, params: {} });
    await second.waitForFirstSync();
    await sim.runFor(5);
    expect(postQueries.mock.calls.length).toBe(0);
    first.unsubscribe();
    second.unsubscribe();
  });

  test('single-flight-queues-second-batch', async () => {
    const sim = createSimTestDriver();
    const db = await openScenarioDb();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let enteredFirst = false;
    const postQueries = mock(async (requests: readonly unknown[]) => {
      if (!enteredFirst) {
        enteredFirst = true;
        await gate;
      }
      return requests.map(() => ({ status: 'not_modified' as const }));
    });
    const queries = makeQueries(2);
    const runtime = new SubscriptionRuntime({
      db,
      postQueries,
      getMergeDeps: () => stubMergeDeps(db),
      onError: () => undefined,
      onSynced: () => undefined,
      timers: sim.timers,
    });
    const first = runtime.subscribe({ name: queries[0]!.name, params: {} });
    runtime.start();
    for (let i = 0; i < 20 && postQueries.mock.calls.length < 1; i += 1) {
      await Promise.resolve();
    }
    expect(postQueries.mock.calls.length).toBe(1);
    runtime.wakeAll();
    await Promise.resolve();
    expect(postQueries.mock.calls.length).toBe(1);
    release();
    await first.waitForFirstSync();
    for (let i = 0; i < 20 && postQueries.mock.calls.length < 2; i += 1) {
      await Promise.resolve();
    }
    expect(postQueries.mock.calls.length).toBe(2);
    runtime.stop();
    void sim;
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
