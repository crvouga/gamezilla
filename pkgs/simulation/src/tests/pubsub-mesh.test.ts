import { describe, expect, test } from 'bun:test';
import { createSeededRng } from '@pkgs/io';

import { createEventLog } from '../events';
import { createSimMesh, createSimPubSubBus } from '../network';

describe('SimPubSubBus', () => {
  test('emit then receive on subscriber', async () => {
    const events = createEventLog({ now: () => 0 });
    const mesh = createSimMesh({
      rng: createSeededRng(1).fork('mesh'),
      events,
      now: () => 0,
      schedule: (fn) => fn(),
    });
    mesh.registerEdge('alice', 'pubsub', 'pubsub');
    mesh.registerEdge('bob', 'pubsub', 'pubsub');
    const bus = createSimPubSubBus({
      brokerId: 'pubsub',
      mesh,
      events,
    });
    const received: unknown[] = [];
    bus.register({
      nodeId: 'bob',
      receive: (_topic, data) => {
        received.push(data);
      },
    });
    await bus.publish({ from: 'alice', topic: 't', data: { ok: true } });
    expect(received).toEqual([{ ok: true }]);
    expect(events.snapshot().some((e) => e.kind === 'pubsub.emit')).toBe(true);
    expect(events.snapshot().some((e) => e.kind === 'pubsub.receive')).toBe(
      true
    );
  });

  test('partition alice–pubsub drops deliver to alice only', async () => {
    const events = createEventLog({ now: () => 0 });
    const mesh = createSimMesh({
      rng: createSeededRng(1).fork('mesh'),
      events,
      now: () => 0,
      schedule: (fn) => fn(),
    });
    mesh.registerEdge('alice', 'pubsub', 'pubsub');
    mesh.registerEdge('bob', 'pubsub', 'pubsub');
    mesh.registerEdge('server', 'pubsub', 'pubsub');
    mesh.partition('pubsub', 'alice');
    const bus = createSimPubSubBus({
      brokerId: 'pubsub',
      mesh,
      events,
    });
    const aliceGot: unknown[] = [];
    const bobGot: unknown[] = [];
    bus.register({
      nodeId: 'alice',
      receive: (_t, d) => {
        aliceGot.push(d);
      },
    });
    bus.register({
      nodeId: 'bob',
      receive: (_t, d) => {
        bobGot.push(d);
      },
    });
    await bus.publish({ from: 'server', topic: 't', data: 2 });
    expect(aliceGot).toEqual([]);
    expect(bobGot).toEqual([2]);
  });

  test('silent subscription drop blocks receive', async () => {
    const events = createEventLog({ now: () => 0 });
    const mesh = createSimMesh({
      rng: createSeededRng(1).fork('mesh'),
      events,
      now: () => 0,
      schedule: (fn) => fn(),
    });
    mesh.registerEdge('alice', 'pubsub', 'pubsub');
    mesh.registerEdge('server', 'pubsub', 'pubsub');
    const bus = createSimPubSubBus({
      brokerId: 'pubsub',
      mesh,
      events,
    });
    const got: unknown[] = [];
    bus.register({
      nodeId: 'alice',
      receive: (_t, d) => {
        got.push(d);
      },
    });
    bus.silentDrop('alice');
    await bus.publish({ from: 'server', topic: 't', data: 'x' });
    expect(got).toEqual([]);
    expect(
      events.snapshot().some((e) => e.kind === 'broker.subscriptionDrop')
    ).toBe(true);
  });
});
