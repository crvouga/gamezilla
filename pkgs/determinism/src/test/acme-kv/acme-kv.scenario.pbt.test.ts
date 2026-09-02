import { describe, expect, test } from 'bun:test';
import fc from 'fast-check';
import type { AnyScenarioDef } from '../../harness/define-scenario';
import { openWorld } from '../../harness/world';
import { replay, runScenario, runWorldProperty } from '../../pbt';
import type { AcmeKvServerHandle } from './nodes';
import { ACME_KV_SCENARIO, acmeKvServerFingerprint } from './scenario';
import { storeFingerprint } from './types';

describe('acme-kv scenario PBT', () => {
  test('runScenario explores knobs + partition/heal + put', async () => {
    await runScenario(ACME_KV_SCENARIO as unknown as AnyScenarioDef, {
      maxCommands: 12,
      numRuns: 6,
    });
  }, 120_000);

  test('dual-open same seed+commands share server fingerprint', async () => {
    await runWorldProperty(
      ACME_KV_SCENARIO as unknown as AnyScenarioDef,
      [fc.constant(null)],
      async (world, _null) => {
        void _null;
        const seed = world.seed;
        const commands = [
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
          commands: [...commands],
        });
        const b = await replay(ACME_KV_SCENARIO as unknown as AnyScenarioDef, {
          seed,
          knobs,
          commands: [...commands],
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
