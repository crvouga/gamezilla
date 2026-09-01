import { beforeAll, describe, expect, test } from 'bun:test';
import fc from 'fast-check';
import {
  arbWorldSeed,
  assertSample,
  assertSampleProperty,
  replay,
} from '../../pbt';
import { openWorld } from '../../world';
import { registerAcmeKvNodeKinds } from './nodes';
import { ACME_KV_SYSTEM, acmeKvServerFingerprint } from './system';
import { storeFingerprint } from './types';

beforeAll(() => {
  registerAcmeKvNodeKinds();
});

describe('acme-kv system PBT', () => {
  test('assertSample explores knobs + partition/heal + put', async () => {
    await assertSample(ACME_KV_SYSTEM, { maxCommands: 12, numRuns: 6 });
  }, 120_000);

  test('dual-open same seed+actions share server fingerprint', async () => {
    await assertSampleProperty(
      'acme-kv dual fingerprint',
      fc.asyncProperty(arbWorldSeed(), async (seed) => {
        const actions = [
          { kind: 'put', clientId: 'c0', key: 'a', value: 'x' },
          { kind: 'partition', clientId: 'c1' },
          { kind: 'put', clientId: 'c0', key: 'b', value: 'y' },
          { kind: 'heal' },
          { kind: 'put', clientId: 'c1', key: 'a', value: 'z' },
        ] as const;
        const knobs = { clientCount: 2 };
        const a = await replay(ACME_KV_SYSTEM, {
          seed,
          knobs,
          actions: [...actions],
        });
        const b = await replay(ACME_KV_SYSTEM, {
          seed,
          knobs,
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
      }),
      { numRuns: 4 }
    );
  }, 60_000);

  test('openWorld boots server + clients', async () => {
    await using world = await openWorld(ACME_KV_SYSTEM, {
      seed: 1,
      knobs: { clientCount: 2 },
    });
    expect(world.node('server').kind).toBe('acme-kv.server');
    expect(world.roleIds('client')).toEqual(['c0', 'c1']);
    expect(storeFingerprint(world.system.serverStore)).toBe('{}');
  });
});
