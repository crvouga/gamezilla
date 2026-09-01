import { describe, expect, test } from 'bun:test';
import fc from 'fast-check';
import { defineSystem, defineSystemKnob } from './define-system';
import type { JsonValue } from './json';
import { defineLibrary } from './library';
import { clearNodeKindRegistry, defineNodeKind } from './node-kind';
import { assertSample, replay } from './pbt/assert-sample';
import { openWorld } from './world';

type FakeSystem = {
  serverEchoes: number;
  clientHits: Map<string, number>;
};

type PingModel = { pings: number };

function asRecord(v: JsonValue): Record<string, unknown> {
  return v as Record<string, unknown>;
}

describe('defineSystem framework world', () => {
  test('boots topology, library dispatch, settle', async () => {
    clearNodeKindRegistry();
    defineNodeKind({
      id: 'fake.server',
      boot: (ctx) => {
        const sys = ctx.system as FakeSystem;
        sys.serverEchoes = 0;
        return { id: ctx.nodeId };
      },
      endpoints: (h) => [
        {
          id: `srv:${(h as { id: string }).id}`,
          deliver: async () => {
            /* noop */
          },
        },
      ],
    });
    defineNodeKind({
      id: 'fake.client',
      boot: (ctx) => {
        const sys = ctx.system as FakeSystem;
        sys.clientHits.set(ctx.nodeId, 0);
        return { id: ctx.nodeId };
      },
      endpoints: (h) => [
        {
          id: `cli:${(h as { id: string }).id}`,
          deliver: async () => {
            /* noop */
          },
        },
      ],
    });

    const system = defineSystem<FakeSystem>({
      id: 'fake.demo',
      system: () => ({ serverEchoes: 0, clientHits: new Map() }),
      knobs: [
        defineSystemKnob({
          id: 'clientCount',
          default: 2,
          arb: fc.integer({ min: 1, max: 3 }),
        }),
      ],
      nodes: [
        { kind: 'fake.server', role: 'server', count: 1 },
        {
          kind: 'fake.client',
          role: 'client',
          countFromKnob: 'clientCount',
          idFor: (i) => `c${i}`,
        },
      ],
      library: [
        defineLibrary<FakeSystem>({
          kind: 'partition',
          arb: (ctx) =>
            fc.constantFrom(...ctx.roleIds('client')).map((clientId) => ({
              kind: 'partition',
              clientId,
            })),
          dispatch: async (world, action) => {
            const a = asRecord(action);
            world.partition(`cli:${String(a['clientId'])}`, 'srv:server');
          },
        }),
        defineLibrary<FakeSystem>({
          kind: 'heal',
          arb: () => fc.constant({ kind: 'heal' }),
          dispatch: async (world) => {
            world.healAll();
          },
        }),
      ],
      domain: {
        arbs: (ctx) => [
          fc.constantFrom(...ctx.roleIds('client')).map((clientId) => ({
            kind: 'ping',
            clientId,
          })),
        ],
        dispatch: async (world, op) => {
          const a = asRecord(op);
          if (a['kind'] !== 'ping') return;
          const clientId = String(a['clientId']);
          const hits = world.system.clientHits.get(clientId) ?? 0;
          world.system.clientHits.set(clientId, hits + 1);
          world.system.serverEchoes += 1;
        },
      },
      model: {
        initial: (): PingModel => ({ pings: 0 }),
        allows: () => true,
        apply: (m, a) => {
          const op = asRecord(a);
          if (op['kind'] === 'ping') (m as PingModel).pings += 1;
        },
      },
      settle: async (world) => {
        world.healAll();
        await world.runUntilIdle();
      },
    });

    await using world = await openWorld(system, {
      seed: 42,
      knobs: { clientCount: 2 },
    });
    expect(world.roleIds('client')).toEqual(['c0', 'c1']);
    expect(world.node('server').id).toBe('server');
    world.partition('cli:c0', 'srv:server');
    expect(world.network.isEdgePartitioned('cli:c0', 'srv:server')).toBe(true);
    world.healAll();

    const { world: w2 } = await replay(system, {
      seed: 7,
      knobs: { clientCount: 2 },
      actions: [
        { kind: 'ping', clientId: 'c0' },
        { kind: 'partition', clientId: 'c1' },
        { kind: 'heal' },
      ],
    });
    expect(w2.system.serverEchoes).toBe(1);
    expect(w2.system.clientHits.get('c0')).toBe(1);
    await w2.dispose();
  });

  test('assertSample runs joint knob + action pool', async () => {
    clearNodeKindRegistry();
    defineNodeKind({
      id: 'fake.solo',
      boot: (ctx) => ({ id: ctx.nodeId }),
    });
    const system = defineSystem({
      id: 'fake.solo',
      knobs: [
        defineSystemKnob({
          id: 'n',
          default: 1,
          arb: fc.constant(1),
        }),
      ],
      nodes: [{ kind: 'fake.solo', role: 'peer', count: 1 }],
      library: [
        defineLibrary({
          kind: 'tick',
          arb: () => fc.constant({ kind: 'tick' }),
          dispatch: async () => {
            /* noop */
          },
        }),
      ],
      settle: async () => {
        /* noop */
      },
    });
    await assertSample(system, { maxCommands: 3, numRuns: 2 });
  });
});
