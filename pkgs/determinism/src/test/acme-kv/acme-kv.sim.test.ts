import { beforeAll, describe, expect, test } from 'bun:test';
import { replay } from '../../pbt';
import { openWorld } from '../../world';
import { registerAcmeKvNodeKinds, sendPut } from './nodes';
import { ACME_KV_SYSTEM, acmeKvServerFingerprint } from './system';
import { clientEndpointId, serverEndpointId, storeFingerprint } from './types';

beforeAll(() => {
  registerAcmeKvNodeKinds();
});

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
      expect(storeFingerprint(world.system.serverStore)).toBe(
        storeFingerprint(world.system.clientCaches.get('c0')!)
      );
      expect(storeFingerprint(world.system.serverStore)).toBe(
        storeFingerprint(world.system.clientCaches.get('c1')!)
      );
      expect(world.system.serverStore.get('a')?.value).toBe('hello');
      expect(world.system.serverStore.get('b')?.value).toBe('world');
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
      system: world.system,
      clientId: 'c0',
      key: 'a',
      value: 'v1',
    });
    await world.runUntilIdle();
    expect(world.system.clientCaches.get('c1')?.get('a')?.value).toBe('v1');

    world.partition(clientEndpointId('c1'), serverEndpointId());
    sendPut({
      system: world.system,
      clientId: 'c0',
      key: 'a',
      value: 'v2',
    });
    await world.runUntilIdle();
    expect(world.system.serverStore.get('a')?.value).toBe('v2');
    expect(world.system.clientCaches.get('c0')?.get('a')?.value).toBe('v2');
    expect(world.system.clientCaches.get('c1')?.get('a')?.value).toBe('v1');

    await world.assertConverged!();
    expect(world.system.clientCaches.get('c1')?.get('a')?.value).toBe('v2');
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
      expect(world.system.serverStore.get('k')?.value).toBe('second');
      expect(world.system.serverStore.get('k')?.writeId).toBe(2);
    } finally {
      await world.dispose();
    }
  });

  test('same seed replay is deterministic', async () => {
    const actions = [
      { kind: 'put', clientId: 'c0', key: 'a', value: 'x' },
      { kind: 'partition', clientId: 'c1' },
      { kind: 'put', clientId: 'c0', key: 'a', value: 'y' },
      { kind: 'heal' },
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
      expect(acmeKvServerFingerprint(a.world.system)).toBe(
        acmeKvServerFingerprint(b.world.system)
      );
    } finally {
      await a.world.dispose();
      await b.world.dispose();
    }
  });
});
