import { describe, expect, test } from 'bun:test';

import type { AnyScenarioDef } from '../../harness/define-scenario';
import { openWorld } from '../../harness/world';
import { replay, runExamples } from '../../pbt';
import type { AcmeKvClientHandle, AcmeKvServerHandle } from './nodes';
import { sendPut } from './nodes';
import { ACME_KV_SCENARIO, acmeKvServerFingerprint } from './scenario';
import { storeFingerprint } from './types';

type AcmeNodes = {
  server: AcmeKvServerHandle;
  client: ReadonlyMap<string, AcmeKvClientHandle>;
};

function nodes(world: { nodes: unknown }): AcmeNodes {
  return world.nodes as AcmeNodes;
}

describe('acme-kv sim pins', () => {
  test('put converges across clients after converge', async () => {
    const { world } = await replay(
      ACME_KV_SCENARIO as unknown as AnyScenarioDef,
      {
        seed: 42,
        knobs: { clientCount: 2 },
        actions: [
          { kind: 'put', clientId: 'c0', key: 'a', value: 'hello' },
          { kind: 'put', clientId: 'c1', key: 'b', value: 'world' },
        ],
      }
    );
    try {
      const n = nodes(world);
      expect(storeFingerprint(n.server.store)).toBe(
        storeFingerprint(n.client.get('c0')!.cache)
      );
      expect(storeFingerprint(n.server.store)).toBe(
        storeFingerprint(n.client.get('c1')!.cache)
      );
      expect(n.server.store.get('a')?.value).toBe('hello');
      expect(n.server.store.get('b')?.value).toBe('world');
    } finally {
      await world.dispose();
    }
  });

  test('partition stalls replicate; heal+converge converges', async () => {
    await using world = await openWorld(ACME_KV_SCENARIO, {
      seed: 7,
      knobs: { clientCount: 2 },
    });
    const n = nodes(world);
    sendPut({
      server: n.server,
      client: n.client.get('c0')!,
      key: 'a',
      value: 'v1',
    });
    await world.quiesce();
    expect(n.client.get('c1')?.cache.get('a')?.value).toBe('v1');

    world.partition('c1', 'server');
    sendPut({
      server: n.server,
      client: n.client.get('c0')!,
      key: 'a',
      value: 'v2',
    });
    await world.quiesce();
    expect(n.server.store.get('a')?.value).toBe('v2');
    expect(n.client.get('c0')?.cache.get('a')?.value).toBe('v2');
    expect(n.client.get('c1')?.cache.get('a')?.value).toBe('v1');

    await world.converge();
    expect(n.client.get('c1')?.cache.get('a')?.value).toBe('v2');
  });

  test('LWW: higher writeId wins', async () => {
    const { world } = await replay(
      ACME_KV_SCENARIO as unknown as AnyScenarioDef,
      {
        seed: 99,
        knobs: { clientCount: 2 },
        actions: [
          { kind: 'put', clientId: 'c0', key: 'k', value: 'first' },
          { kind: 'put', clientId: 'c1', key: 'k', value: 'second' },
        ],
      }
    );
    try {
      expect(nodes(world).server.store.get('k')?.value).toBe('second');
      expect(nodes(world).server.store.get('k')?.writeId).toBe(2);
    } finally {
      await world.dispose();
    }
  });

  test('same seed replay is deterministic', async () => {
    const actions = [
      { kind: 'put', clientId: 'c0', key: 'a', value: 'x' },
      { kind: 'network.partition', from: 'c1', to: 'server' },
      { kind: 'put', clientId: 'c0', key: 'a', value: 'y' },
      { kind: 'network.healAll' },
      { kind: 'put', clientId: 'c1', key: 'b', value: 'z' },
    ] as const;
    const a = await replay(ACME_KV_SCENARIO as unknown as AnyScenarioDef, {
      seed: 12345,
      knobs: { clientCount: 2 },
      actions: [...actions],
    });
    const fpA = acmeKvServerFingerprint(nodes(a.world).server);
    await a.world.dispose();
    const b = await replay(ACME_KV_SCENARIO as unknown as AnyScenarioDef, {
      seed: 12345,
      knobs: { clientCount: 2 },
      actions: [...actions],
    });
    try {
      expect(fpA).toBe(acmeKvServerFingerprint(nodes(b.world).server));
    } finally {
      await b.world.dispose();
    }
  });

  test('runExamples named matrices', async () => {
    await runExamples(
      ACME_KV_SCENARIO as unknown as AnyScenarioDef,
      [
        {
          name: 'partition-then-heal',
          inputs: {
            startTime: 0,
            knobs: { clientCount: 2 },
            actions: [
              { kind: 'put', clientId: 'c0', key: 'a', value: 'x' },
              { kind: 'network.partition', from: 'c1', to: 'server' },
              { kind: 'put', clientId: 'c0', key: 'a', value: 'y' },
              { kind: 'network.healAll' },
            ],
            networkFaults: {
              latencyMeanMs: 0,
              latencyJitterMs: 0,
              dropProbability: 0,
              duplicateProbability: 0,
              reorderWindowMs: 0,
              partitionProbability: 0,
              healProbability: 0,
            },
          },
        },
      ],
      { seeds: [1, 2, 3] }
    );
  });
});
