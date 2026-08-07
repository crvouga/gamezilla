import { afterEach, describe, expect, mock, test } from 'bun:test';
import {
  createInMemoryPubSub,
  type InMemoryPubSub,
} from '@pkgs/pubsub/testing';
import { sql } from '@pkgs/sql';
import { z } from 'zod';
import { createTableChangeBus } from '../queries/client/table-change-bus';
import { defineQuery } from '../queries/core/define-query';
import { queryRegistry } from '../queries/core/registry';
import { scopeHash } from '../queries/shared/canonical';
import { openScenarioDb } from '../queries/test/scenario-fixture';
import type { QueryChannelsCtx } from '../shared/nudge-payload';
import { createSimTestDriver } from '../sim/test-driver';
import { attachNudges } from './attach-nudges';
import { SubscriptionRuntime } from './subscription-runtime';

type WideChannelsCtx = QueryChannelsCtx & {
  readonly membershipSpaceIds: readonly string[];
};

const emptyMutationRegistry = {};
const testBus = () => createTableChangeBus();

describe('attachNudges', () => {
  const disposers: Array<() => void> = [];
  afterEach(() => {
    for (const d of disposers.splice(0)) d();
  });

  async function setup(opts?: {
    membershipSpaceIds?: readonly string[];
    debounceMs?: number;
    lateTopicRemakeMs?: number;
  }) {
    const sim = createSimTestDriver();
    const db = await openScenarioDb();
    const postQueries = mock(async (requests: readonly unknown[]) =>
      requests.map(() => ({ status: 'not_modified' as const }))
    );
    const userScoped = defineQuery({
      name: 'ownStuff',
      params: z.object({}),
      hydrates: ['notes'],
      limit: 10,
      channels: (_p, ctx: QueryChannelsCtx) => [`user:${ctx.actorId}`],
      async run() {
        return { notes: [] };
      },
    });
    const roomScoped = defineQuery({
      name: 'roomStuff',
      params: z.object({}),
      hydrates: ['notes'],
      limit: 10,
      channels: (_p, ctx) =>
        ((ctx as WideChannelsCtx).membershipSpaceIds ?? []).map(
          (id) => `room:${id}` as const
        ),
      async run() {
        return { notes: [] };
      },
    });
    const pollOnly = defineQuery({
      name: 'pollOnly',
      params: z.object({}),
      hydrates: ['notes'],
      limit: 10,
      async run() {
        return { notes: [] };
      },
    });
    const registry = queryRegistry([userScoped, roomScoped, pollOnly]);
    const runtime = new SubscriptionRuntime({
      db,
      boot: [{ name: 'ownStuff', params: {} }],
      postQueries,
      getMergeDeps: () => ({
        db,
        registry: {},
        env: {
          actorId: 'actor1',
          deviceId: 'd1',
          accountId: null,
          isAnon: true,
          now: () => new Date(sim.now()),
        },
        bus: { emit: () => undefined, subscribe: () => () => undefined },
        clientId: 'c1',
      }),
      onError: () => undefined,
      onSynced: () => undefined,
      random: sim.random,
      timers: sim.timers,
    });
    runtime.start();
    await runtime.waitForBoot();
    postQueries.mockClear();

    const pubsub = createInMemoryPubSub() as InMemoryPubSub;
    let remakeCount = 0;
    let current = pubsub;
    const remakePubSub = (): InMemoryPubSub => {
      remakeCount += 1;
      current = createInMemoryPubSub() as InMemoryPubSub;
      return current;
    };

    let wakeAllHook: (() => void) | undefined;
    const dispose = attachNudges({
      pubsub,
      runtime,
      queryRegistry: registry,
      mutationRegistry: emptyMutationRegistry,
      bus: testBus(),
      db,
      getChannelsCtx: () => ({
        actorId: 'actor1',
        membershipSpaceIds: opts?.membershipSpaceIds ?? [],
      }),
      remakePubSub,
      debounceMs: opts?.debounceMs ?? 50,
      lateTopicRemakeMs: opts?.lateTopicRemakeMs ?? 30,
      timers: sim.timers,
      onScheduleWakeAll: (fn) => {
        wakeAllHook = fn;
      },
    });
    disposers.push(dispose);
    disposers.push(() => runtime.stop());
    // Let attachNudges subscription sync settle before counting polls.
    await sim.runFor(5);
    postQueries.mockClear();

    return {
      sim,
      db,
      runtime,
      postQueries,
      pubsub: () => current,
      remakeCount: () => remakeCount,
      wakeAllHook: () => wakeAllHook,
      scope: scopeHash('ownStuff', {}),
    };
  }

  test('nudge-triggers-single-debounced-refetch', async () => {
    const { sim, postQueries, pubsub, scope } = await setup();
    await pubsub().publish('user:actor1', {});
    await sim.runFor(10);
    expect(postQueries.mock.calls.length).toBe(1);

    postQueries.mockClear();
    await pubsub().publish('user:actor1', {});
    await pubsub().publish('user:actor1', {});
    await pubsub().publish('user:actor1', {});
    await sim.runFor(80);
    expect(postQueries.mock.calls.length).toBeLessThanOrEqual(2);
    expect(postQueries.mock.calls.length).toBeGreaterThanOrEqual(1);
    void scope;
  });

  test('shared-topic-nudge-batches-scopes', async () => {
    const sim = createSimTestDriver();
    const db = await openScenarioDb();
    const postQueries = mock(async (requests: readonly unknown[]) =>
      requests.map(() => ({ status: 'not_modified' as const }))
    );
    const q1 = defineQuery({
      name: 'ownStuff',
      params: z.object({}),
      hydrates: ['notes'],
      limit: 10,
      channels: (_p, ctx: QueryChannelsCtx) => [`user:${ctx.actorId}`],
      async run() {
        return { notes: [] };
      },
    });
    const q2 = defineQuery({
      name: 'ownStuff2',
      params: z.object({}),
      hydrates: ['notes'],
      limit: 10,
      channels: (_p, ctx: QueryChannelsCtx) => [`user:${ctx.actorId}`],
      async run() {
        return { notes: [] };
      },
    });
    const q3 = defineQuery({
      name: 'ownStuff3',
      params: z.object({}),
      hydrates: ['notes'],
      limit: 10,
      channels: (_p, ctx: QueryChannelsCtx) => [`user:${ctx.actorId}`],
      async run() {
        return { notes: [] };
      },
    });
    const registry = queryRegistry([q1, q2, q3]);
    const runtime = new SubscriptionRuntime({
      db,
      boot: [
        { name: 'ownStuff', params: {} },
        { name: 'ownStuff2', params: {} },
        { name: 'ownStuff3', params: {} },
      ],
      postQueries,
      getMergeDeps: () => ({
        db,
        registry: {},
        env: {
          actorId: 'actor1',
          deviceId: 'd1',
          accountId: null,
          isAnon: true,
          now: () => new Date(),
        },
        bus: { emit: () => undefined, subscribe: () => () => undefined },
        clientId: 'c1',
      }),
      onError: () => undefined,
      onSynced: () => undefined,
      random: sim.random,
      timers: sim.timers,
    });
    runtime.start();
    await runtime.waitForBoot();
    postQueries.mockClear();
    const pubsub = createInMemoryPubSub() as InMemoryPubSub;
    disposers.push(
      attachNudges({
        pubsub,
        runtime,
        queryRegistry: registry,
        mutationRegistry: emptyMutationRegistry,
        bus: testBus(),
        db,
        getChannelsCtx: () => ({ actorId: 'actor1' }),
        remakePubSub: () => createInMemoryPubSub() as InMemoryPubSub,
        debounceMs: 40,
        timers: sim.timers,
      })
    );
    disposers.push(() => runtime.stop());
    await sim.runFor(5);
    postQueries.mockClear();
    await pubsub.publish('user:actor1', {});
    await sim.runFor(20);
    expect(postQueries.mock.calls.length).toBe(1);
    expect(
      (postQueries.mock.calls[0]?.[0] as readonly unknown[]).length
    ).toBe(3);
  });

  test('nudge-checkpoint-skip', async () => {
    const { sim, db, postQueries, pubsub, scope } = await setup();
    await db.run(sql`
      INSERT INTO _scope_meta (scope_hash, last_active_at, last_checkpoint, last_hash)
      VALUES (${scope}, ${'now'}, ${'1000000000000000000'}, ${'h'})
    `);
    await pubsub().publish('user:actor1', {
      checkpoint: '0999999999999000000',
    });
    await sim.runFor(40);
    expect(postQueries.mock.calls.length).toBe(0);
  });

  test('self-echo-deduped', async () => {
    const { sim, postQueries, pubsub, wakeAllHook } = await setup({
      debounceMs: 80,
    });
    await pubsub().publish('user:actor1', {});
    wakeAllHook()?.();
    await sim.runFor(120);
    // Leading + at most one trailing for events inside the window.
    expect(postQueries.mock.calls.length).toBeLessThanOrEqual(2);
    expect(postQueries.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  test('socket-down-stays-quiet-reconnect-catchup', async () => {
    const { sim, runtime, postQueries, pubsub } = await setup();
    const wakeJitter = mock((_maxMs: number) => undefined);
    const original = runtime.wakeAllWithJitter.bind(runtime);
    runtime.wakeAllWithJitter = (maxMs: number) => {
      wakeJitter(maxMs);
      original(maxMs);
    };

    pubsub().setStatusForTest('down');
    await sim.runFor(20);
    // Down does not wake — avoids reconnect storms.
    expect(wakeJitter).not.toHaveBeenCalled();
    postQueries.mockClear();
    await sim.runFor(90);
    expect(postQueries.mock.calls.length).toBe(0);

    wakeJitter.mockClear();
    pubsub().setStatusForTest('connected');
    await sim.runFor(20);
    expect(wakeJitter).toHaveBeenCalled();
  });

  test('topic-lifecycle-follows-subscriptions', async () => {
    const { sim, runtime, pubsub } = await setup({
      membershipSpaceIds: ['space_a'],
    });
    expect([...pubsub().subscribedTopicsForTest()].sort()).toEqual([
      'user:actor1',
    ]);

    const sub = runtime.subscribe({ name: 'roomStuff', params: {} });
    await sim.runFor(5);
    expect([...pubsub().subscribedTopicsForTest()].sort()).toEqual([
      'room:space_a',
      'user:actor1',
    ]);

    sub.unsubscribe();
    await sim.runFor(5);
    expect([...pubsub().subscribedTopicsForTest()].sort()).toEqual([
      'user:actor1',
    ]);
  });

  test('unrelated-topic-ignored', async () => {
    const { sim, postQueries, pubsub } = await setup();
    await pubsub().publish('user:other', {});
    await sim.runFor(40);
    expect(postQueries.mock.calls.length).toBe(0);
  });

  test('late-topic-triggers-remake', async () => {
    const { sim, runtime, remakeCount, pubsub } = await setup({
      membershipSpaceIds: [],
      lateTopicRemakeMs: 40,
    });
    runtime.subscribe({ name: 'roomStuff', params: {} });
    await sim.runFor(5);
    expect(remakeCount()).toBe(0);

    const sim2 = createSimTestDriver();
    const db = await openScenarioDb();
    const postQueries = mock(async (requests: readonly unknown[]) =>
      requests.map(() => ({ status: 'not_modified' as const }))
    );
    let memberships: string[] = [];
    const q = defineQuery({
      name: 'dynamicRooms',
      params: z.object({}),
      hydrates: ['notes'],
      limit: 10,
      channels: (_p, ctx) =>
        ((ctx as WideChannelsCtx).membershipSpaceIds ?? []).map(
          (id) => `room:${id}` as const
        ),
      async run() {
        return { notes: [] };
      },
    });
    const registry = queryRegistry([q]);
    const runtime2 = new SubscriptionRuntime({
      db,
      boot: [{ name: 'dynamicRooms', params: {} }],
      postQueries,
      getMergeDeps: () => ({
        db,
        registry: {},
        env: {
          actorId: 'a',
          deviceId: 'd',
          accountId: null,
          isAnon: true,
          now: () => new Date(sim2.now()),
        },
        bus: { emit: () => undefined, subscribe: () => () => undefined },
        clientId: 'c',
      }),
      onError: () => undefined,
      onSynced: () => undefined,
      random: sim2.random,
      timers: sim2.timers,
    });
    runtime2.start();
    await runtime2.waitForBoot();
    let remakes = 0;
    const first = createInMemoryPubSub() as InMemoryPubSub;
    let current = first;
    const dispose = attachNudges({
      pubsub: first,
      runtime: runtime2,
      queryRegistry: registry,
      mutationRegistry: emptyMutationRegistry,
      bus: testBus(),
      db,
      getChannelsCtx: () => ({
        actorId: 'a',
        membershipSpaceIds: memberships,
      }),
      remakePubSub: () => {
        remakes += 1;
        current = createInMemoryPubSub() as InMemoryPubSub;
        return current;
      },
      lateTopicRemakeMs: 40,
      debounceMs: 20,
      timers: sim2.timers,
    });
    disposers.push(dispose, () => runtime2.stop());

    memberships = ['space_new'];
    runtime2.subscribe({ name: 'dynamicRooms', params: {} });
    await sim2.runFor(80);
    expect(remakes).toBe(1);
    expect(current.subscribedTopicsForTest()).toContain('room:space_new');
    void pubsub;
    void sim;
    void runtime;
  });

  test('no-pubsub-stays-quiet-after-hydrate', async () => {
    const sim = createSimTestDriver();
    const db = await openScenarioDb();
    const postQueries = mock(async (requests: readonly unknown[]) =>
      requests.map(() => ({ status: 'not_modified' as const }))
    );
    const runtime = new SubscriptionRuntime({
      db,
      boot: [{ name: 'pollOnlyBoot', params: {} }],
      postQueries,
      getMergeDeps: () => ({
        db,
        registry: {},
        env: {
          actorId: 'a',
          deviceId: 'd',
          accountId: null,
          isAnon: true,
          now: () => new Date(sim.now()),
        },
        bus: { emit: () => undefined, subscribe: () => () => undefined },
        clientId: 'c',
      }),
      onError: () => undefined,
      onSynced: () => undefined,
      random: sim.random,
      timers: sim.timers,
    });
    runtime.start();
    await runtime.waitForBoot();
    postQueries.mockClear();
    await sim.runFor(90);
    expect(postQueries.mock.calls.length).toBe(0);
    runtime.stop();
  });
});
