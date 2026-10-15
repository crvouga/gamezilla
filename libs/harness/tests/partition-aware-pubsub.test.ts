import { expect, test } from 'bun:test';
import { createHarnessNet } from '@libs/harness/net';
import {
  PUBSUB_HEARTBEAT_MS,
  partitionAwarePubSub,
} from '@libs/harness/partition-aware-pubsub';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { createNoopLogger } from '@pkgs/logger-shared/logger';
import {
  createInMemoryBus,
  createInMemoryPubSub,
} from '@pkgs/pubsub-root-shared/in-memory';

test('a connection restored before the heartbeat still signals recovery', () => {
  // regression: harness-pubsub-misses-short-disconnect
  const { clock, timers } = createHarnessClock();
  const net = createHarnessNet();
  const client = partitionAwarePubSub({
    inner: createInMemoryPubSub({
      bus: createInMemoryBus(),
      logger: createNoopLogger(),
    }),
    reachable: () => net.isReachable('alice', 'server'),
    subscribeReachability: net.subscribe,
    timers,
  });
  const statuses: string[] = [];
  client.onStatus((value) => statuses.push(value));
  const started = clock.now();
  net.partition('alice', 'server');
  net.heal('alice', 'server');
  expect(clock.now()).toBe(started);
  expect(statuses).toEqual(['down', 'connected']);
  client.close();
  net.partition('alice', 'server');
  expect(statuses).toEqual(['down', 'connected']);
  expect(clock.nextDueAt()).toBeNull();
});

test('a cut event connection drops live changes and signals recovery', async () => {
  // regression: product-harness-offline-events-leak
  const { clock, timers } = createHarnessClock();
  const bus = createInMemoryBus();
  const logger = createNoopLogger();
  const server = createInMemoryPubSub({ bus, logger });
  let reachable = true;
  const client = partitionAwarePubSub({
    inner: createInMemoryPubSub({ bus, logger }),
    reachable: () => reachable,
    subscribeReachability: () => () => undefined,
    timers,
  });
  const received: unknown[] = [];
  const statuses: string[] = [];
  client.subscribe('friends', (value) => received.push(value));
  client.onStatus((value) => statuses.push(value));
  await server.publish('friends', 'before');
  reachable = false;
  await server.publish('friends', 'while-offline');
  expect(received).toEqual(['before']);
  await expect(client.publish('friends', 'unsent')).rejects.toThrow(
    'unreachable'
  );
  clock.advance(PUBSUB_HEARTBEAT_MS);
  expect(statuses).toEqual(['down']);
  reachable = true;
  clock.advance(PUBSUB_HEARTBEAT_MS);
  expect(statuses).toEqual(['down', 'connected']);
  await server.publish('friends', 'after');
  expect(received).toEqual(['before', 'after']);
  client.close();
  expect(clock.nextDueAt()).toBeNull();
  server.close();
});
