import { describe, expect, test } from 'bun:test';

import type { AnyScenarioDef } from '../../harness/define-scenario';
import { openWorld } from '../../harness/world';
import { check, replay } from '../../pbt';
import type { AcmeKvServerHandle } from './nodes';
import { ACME_KV_SCENARIO, acmeKvServerFingerprint } from './scenario';
import { storeFingerprint } from './types';

describe('acme-kv scenario PBT', () => {
  test('check explores knobs + partition/heal + put', async () => {
    const report = await check(ACME_KV_SCENARIO as unknown as AnyScenarioDef, {
      episodeLength: 12,
      episodes: 6,
      vacuity: 'warn',
    });
    expect(report.episodes).toBe(6);
  }, 120_000);

  test('dual-open same seed+actions share server fingerprint', async () => {
    const seed = 424242;
    const actions = [
      { kind: 'put', clientId: 'c0', key: 'a', value: 'x' },
      { kind: 'network.partition', from: 'c1', to: 'server' },
      { kind: 'put', clientId: 'c0', key: 'b', value: 'y' },
      { kind: 'network.healAll' },
      { kind: 'put', clientId: 'c1', key: 'a', value: 'z' },
    ] as const;
    const knobs = { clientCount: 2 };
    const a = await replay(ACME_KV_SCENARIO as unknown as AnyScenarioDef, {
      seed,
      knobs,
      actions: [...actions],
    });
    const fpA = acmeKvServerFingerprint(
      (a.world.nodes as unknown as { server: AcmeKvServerHandle }).server
    );
    await a.world.dispose();
    const b = await replay(ACME_KV_SCENARIO as unknown as AnyScenarioDef, {
      seed,
      knobs,
      actions: [...actions],
    });
    try {
      expect(fpA).toBe(
        acmeKvServerFingerprint(
          (b.world.nodes as unknown as { server: AcmeKvServerHandle }).server
        )
      );
    } finally {
      await b.world.dispose();
    }
  }, 60_000);

  test('openWorld starts server + clients', async () => {
    await using world = await openWorld(ACME_KV_SCENARIO, {
      seed: 1,
      knobs: { clientCount: 2 },
    });
    const nodes = world.nodes as unknown as {
      server: AcmeKvServerHandle;
      client: ReadonlyMap<string, unknown>;
    };
    expect(nodes.server.id).toBe('server');
    expect(world.nodeIds('client')).toEqual(['c0', 'c1']);
    expect(storeFingerprint(nodes.server.store)).toBe('{}');
  });
});
