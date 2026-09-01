import { describe, expect, test } from 'bun:test';
import { assertFaultPins, replay } from '../../pbt';
import { openWorld } from '../../world';
import { sendPut } from './nodes';
import { ACME_KV_SYSTEM, acmeKvServerFingerprint } from './system';
import { storeFingerprint } from './types';

describe('acme-kv sim pins', () => {
  test('put converges across clients after settle', async () => {
    const { world } = await replay(ACME_KV_SYSTEM, {
      seed: 42,
      knobs: { clientCount: 2 },
      actions: [
        { kind: 'put', clientId: 'c0', key: 'a', value: 'hello' },
        { kind: 'put', clientId: 'c1', key: 'b', value: 'world' },
      ],
    });
    try {
      expect(storeFingerprint(world.state.serverStore)).toBe(
        storeFingerprint(world.state.clientCaches.get('c0')!)
      );
      expect(storeFingerprint(world.state.serverStore)).toBe(
        storeFingerprint(world.state.clientCaches.get('c1')!)
      );
      expect(world.state.serverStore.get('a')?.value).toBe('hello');
      expect(world.state.serverStore.get('b')?.value).toBe('world');
    } finally {
      await world.dispose();
    }
  });

  test('partition stalls replicate; heal+settle converges', async () => {
    await using world = await openWorld(ACME_KV_SYSTEM, {
      seed: 7,
      knobs: { clientCount: 2 },
    });
    sendPut({
      state: world.state,
      clientId: 'c0',
      key: 'a',
      value: 'v1',
    });
    await world.idle();
    expect(world.state.clientCaches.get('c1')?.get('a')?.value).toBe('v1');

    world.partition('c1', 'server');
    sendPut({
      state: world.state,
      clientId: 'c0',
      key: 'a',
      value: 'v2',
    });
    await world.idle();
    expect(world.state.serverStore.get('a')?.value).toBe('v2');
    expect(world.state.clientCaches.get('c0')?.get('a')?.value).toBe('v2');
    expect(world.state.clientCaches.get('c1')?.get('a')?.value).toBe('v1');

    await world.settle();
    expect(world.state.clientCaches.get('c1')?.get('a')?.value).toBe('v2');
  });

  test('LWW: higher writeId wins', async () => {
    const { world } = await replay(ACME_KV_SYSTEM, {
      seed: 99,
      knobs: { clientCount: 2 },
      actions: [
        { kind: 'put', clientId: 'c0', key: 'k', value: 'first' },
        { kind: 'put', clientId: 'c1', key: 'k', value: 'second' },
      ],
    });
    try {
      expect(world.state.serverStore.get('k')?.value).toBe('second');
      expect(world.state.serverStore.get('k')?.writeId).toBe(2);
    } finally {
      await world.dispose();
    }
  });

  test('same seed replay is deterministic', async () => {
    const actions = [
      { kind: 'put', clientId: 'c0', key: 'a', value: 'x' },
      { kind: 'std.partition', from: 'c1', to: 'server' },
      { kind: 'put', clientId: 'c0', key: 'a', value: 'y' },
      { kind: 'std.healAll' },
      { kind: 'put', clientId: 'c1', key: 'b', value: 'z' },
    ] as const;
    const a = await replay(ACME_KV_SYSTEM, {
      seed: 12345,
      knobs: { clientCount: 2 },
      actions: [...actions],
    });
    const b = await replay(ACME_KV_SYSTEM, {
      seed: 12345,
      knobs: { clientCount: 2 },
      actions: [...actions],
    });
    try {
      expect(acmeKvServerFingerprint(a.world.state)).toBe(
        acmeKvServerFingerprint(b.world.state)
      );
    } finally {
      await a.world.dispose();
      await b.world.dispose();
    }
  });

  test('assertFaultPins named matrices', async () => {
    await assertFaultPins(ACME_KV_SYSTEM, [
      {
        name: 'partition-then-heal',
        knobs: { clientCount: 2 },
        actions: [
          { kind: 'put', clientId: 'c0', key: 'a', value: 'x' },
          { kind: 'std.partition', from: 'c1', to: 'server' },
          { kind: 'put', clientId: 'c0', key: 'a', value: 'y' },
          { kind: 'std.healAll' },
        ],
      },
    ]);
  });
});
