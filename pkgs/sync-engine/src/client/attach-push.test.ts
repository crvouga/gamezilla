import { afterEach, describe, expect, mock, test } from 'bun:test';
import {
  createInMemoryPubSub,
  type InMemoryPubSub,
} from '@pkgs/pubsub/testing';
import { z } from 'zod';

import { defineQuery } from '../queries/core/define-query';
import { queryRegistry } from '../queries/core/registry';
import { openScenarioDb } from '../queries/test/scenario-fixture';
import type { QueryChannelsCtx } from '../shared/push-payload';
import { createSimTestDriver } from '../sim/test-driver';
import { attachPush } from './attach-push';
import { SubscriptionRuntime } from './subscription-runtime';

type WideChannelsCtx = QueryChannelsCtx & {
  readonly membershipSpaceIds: readonly string[];
};

describe('attachPush', () => {
  const disposers: Array<() => void> = [];

  afterEach(() => {
    for (const dispose of disposers.splice(0)) dispose();
  });

  async function setup() {
    const sim = createSimTestDriver();
    const db = await openScenarioDb();
    const postQueries = mock(async (requests: readonly unknown[]) =>
      requests.map(() => ({ status: 'not_modified' as const }))
    );
    const ownStuff = defineQuery({
      name: 'ownStuff',
      params: z.object({}),
      hydrates: ['notes'],
      limit: 10,
      channels: (_params, ctx: QueryChannelsCtx) => [`user:${ctx.actorId}`],
      async run() {
        return { notes: [] };
      },
    });
    const roomStuff = defineQuery({
      name: 'roomStuff',
      params: z.object({}),
      hydrates: ['rooms'],
      limit: 10,
      channels: (_params, ctx) =>
        ((ctx as WideChannelsCtx).membershipSpaceIds ?? []).map(
          (id) => `room:${id}` as const
        ),
      async run() {
        return { rooms: [] };
      },
    });
    const registry = queryRegistry([ownStuff, roomStuff]);
    const runtime = new SubscriptionRuntime({
      db,
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
      timers: sim.timers,
    });
    const session = runtime.subscribe({ name: 'ownStuff', params: {} });
    runtime.start();
    await session.waitForFirstSync();
    postQueries.mockClear();

    let memberships: readonly string[] = [];
    let current = createInMemoryPubSub() as InMemoryPubSub;
    let remakes = 0;
    let refreshTopics = (): void => undefined;
    const dispose = attachPush({
      pubsub: current,
      runtime,
      queryRegistry: registry,
      getChannelsCtx: () => ({
        actorId: 'actor1',
        membershipSpaceIds: memberships,
      }),
      db,
      remakePubSub: () => {
        remakes += 1;
        current = createInMemoryPubSub() as InMemoryPubSub;
        return current;
      },
      timers: sim.timers,
      onBindTopicRefresh: (refresh) => {
        refreshTopics = refresh;
      },
    });
    disposers.push(dispose, () => runtime.stop());
    postQueries.mockClear();

    return {
      sim,
      runtime,
      postQueries,
      pubsub: () => current,
      remakes: () => remakes,
      setMemberships: (ids: readonly string[]) => {
        memberships = ids;
      },
      refreshTopics: () => refreshTopics(),
    };
  }

  test('push refetches the subscribed scope', async () => {
    const { sim, postQueries, pubsub } = await setup();

    await pubsub().publish('user:actor1', { pushSeq: '1' });
    await sim.runFor(40);

    expect(postQueries.mock.calls).toHaveLength(1);
    expect(postQueries.mock.calls[0]?.[0]).toHaveLength(1);
  });

  test('push tables filter unrelated scopes', async () => {
    const { sim, runtime, postQueries, pubsub, setMemberships, refreshTopics } =
      await setup();
    setMemberships(['space-a']);
    const room = runtime.subscribe({ name: 'roomStuff', params: {} });
    await room.waitForFirstSync();
    refreshTopics();
    postQueries.mockClear();

    await pubsub().publish('user:actor1', {
      pushSeq: '1',
      tables: ['rooms'],
    });
    await sim.runFor(40);
    expect(postQueries.mock.calls).toHaveLength(0);

    await pubsub().publish('room:space-a', {
      pushSeq: '1',
      tables: ['rooms'],
    });
    await sim.runFor(40);
    expect(postQueries.mock.calls).toHaveLength(1);
    expect(postQueries.mock.calls[0]?.[0]).toHaveLength(1);
  });

  test('reconnect wakes all with the no-argument API', async () => {
    const { runtime, pubsub } = await setup();
    const wakeAll = mock(() => undefined);
    runtime.wakeAll = wakeAll;

    pubsub().setStatusForTest('down');
    expect(wakeAll).not.toHaveBeenCalled();
    pubsub().setStatusForTest('connected');

    expect(wakeAll).toHaveBeenCalledTimes(1);
    expect(wakeAll.mock.calls[0]).toEqual([]);
  });

  test('topic change remakes pubsub immediately', async () => {
    const { sim, runtime, pubsub, remakes, setMemberships, refreshTopics } =
      await setup();
    const initialRemakes = remakes();
    setMemberships(['space-a']);
    const room = runtime.subscribe({ name: 'roomStuff', params: {} });
    await room.waitForFirstSync();
    refreshTopics();
    await Promise.resolve();
    await Promise.resolve();
    await sim.runFor(1);

    expect(remakes()).toBeGreaterThan(initialRemakes);
    expect([...pubsub().subscribedTopicsForTest()].sort()).toEqual([
      'room:space-a',
      'user:actor1',
    ]);
  });

  test('unchanged topic refresh does not remake pubsub', async () => {
    const { remakes, refreshTopics } = await setup();
    const before = remakes();

    refreshTopics();
    await Promise.resolve();
    await Promise.resolve();
    refreshTopics();
    await Promise.resolve();
    await Promise.resolve();

    expect(remakes()).toBe(before);
  });

  test('duplicate and out-of-order pushes are dropped after applied', async () => {
    const { sim, postQueries, pubsub } = await setup();

    await pubsub().publish('user:actor1', { pushSeq: '2' });
    await sim.runFor(40);
    expect(postQueries.mock.calls).toHaveLength(1);
    postQueries.mockClear();

    // Duplicate — stale.
    await pubsub().publish('user:actor1', { pushSeq: '2' });
    await sim.runFor(40);
    expect(postQueries.mock.calls).toHaveLength(0);

    // Older — stale.
    await pubsub().publish('user:actor1', { pushSeq: '1' });
    await sim.runFor(40);
    expect(postQueries.mock.calls).toHaveLength(0);

    // Newer — wake.
    await pubsub().publish('user:actor1', { pushSeq: '3' });
    await sim.runFor(40);
    expect(postQueries.mock.calls).toHaveLength(1);
  });

  test('push without pushSeq is ignored', async () => {
    const { sim, postQueries, pubsub } = await setup();
    await pubsub().publish('user:actor1', { tables: ['notes'] });
    await sim.runFor(40);
    expect(postQueries.mock.calls).toHaveLength(0);
  });
});
