import { describe, expect, test } from 'bun:test';
import fc from 'fast-check';
import type { AnySystemDef } from '../../define-system';
import { assertSample, assertWorldProperty, replay } from '../../pbt';
import { openWorld } from '../../world';
import type { AcmeKvServerHandle } from './nodes';
import { ACME_KV_SYSTEM, acmeKvServerFingerprint } from './system';
import { storeFingerprint } from './types';

describe('acme-kv system PBT', () => {
  test('assertSample explores knobs + partition/heal + put', async () => {
    await assertSample(ACME_KV_SYSTEM as unknown as AnySystemDef, {
      maxCommands: 12,
      numRuns: 6,
    });
  }, 120_000);

  test('dual-open same seed+actions share server fingerprint', async () => {
    await assertWorldProperty(
      ACME_KV_SYSTEM as unknown as AnySystemDef,
      [fc.constant(null)],
      async (world, _null) => {
        void _null;
        const seed = world.seed;
        const actions = [
          { kind: 'put', clientId: 'c0', key: 'a', value: 'x' },
          { kind: 'chaos.partition', from: 'c1', to: 'server' },
          { kind: 'put', clientId: 'c0', key: 'b', value: 'y' },
          { kind: 'chaos.healAll' },
          { kind: 'put', clientId: 'c1', key: 'a', value: 'z' },
        ] as const;
        const knobs = { clientCount: 2 };
        const a = await replay(ACME_KV_SYSTEM as unknown as AnySystemDef, {
          seed,
          knobs,
          actions: [...actions],
        });
        const b = await replay(ACME_KV_SYSTEM as unknown as AnySystemDef, {
          seed,
          knobs,
          actions: [...actions],
        });
        try {
          expect(
            acmeKvServerFingerprint(
              (a.world.nodes as unknown as { server: AcmeKvServerHandle })
                .server
            )
          ).toBe(
            acmeKvServerFingerprint(
              (b.world.nodes as unknown as { server: AcmeKvServerHandle })
                .server
            )
          );
        } finally {
          await a.world.dispose();
          await b.world.dispose();
        }
      },
      { numRuns: 4 }
    );
  }, 60_000);

  test('openWorld boots server + clients', async () => {
    await using world = await openWorld(ACME_KV_SYSTEM, {
      seed: 1,
      knobs: { clientCount: 2 },
    });
    const nodes = world.nodes as unknown as {
      server: AcmeKvServerHandle;
      client: ReadonlyMap<string, unknown>;
    };
    expect(nodes.server.id).toBe('server');
    expect(world.ids('client')).toEqual(['c0', 'c1']);
    expect(storeFingerprint(nodes.server.store)).toBe('{}');
  });
});
