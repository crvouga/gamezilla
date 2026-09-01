import { describe, expect, test } from 'bun:test';
import fc from 'fast-check';
import { defineAction } from './action';
import { defineSystem } from './define-system';
import { defineKnob } from './knobs';
import { defineNodeKind } from './node-kind';
import { assertSample, replay } from './pbt/assert-sample';
import { openWorld } from './world';

type FakeState = {
  serverEchoes: number;
  clientHits: Map<string, number>;
};

type PingModel = { pings: number };

type PingAction = {
  readonly kind: 'ping';
  readonly clientId: string;
};

describe('defineSystem framework world', () => {
  test('boots topology, action dispatch, settle', async () => {
    const fakeServer = defineNodeKind({
      id: 'fake.server',
      boot: (ctx) => {
        const state = ctx.state as FakeState;
        state.serverEchoes = 0;
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
    const fakeClient = defineNodeKind({
      id: 'fake.client',
      boot: (ctx) => {
        const state = ctx.state as FakeState;
        state.clientHits.set(ctx.nodeId, 0);
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

    const ping = defineAction<FakeState, PingAction, PingModel>({
      kind: 'ping',
      class: 'domain',
      arb: (ctx) =>
        fc.constantFrom(...ctx.roleIds('client')).map((clientId) => ({
          kind: 'ping' as const,
          clientId,
        })),
      dispatch: async (world, action) => {
        const hits = world.state.clientHits.get(action.clientId) ?? 0;
        world.state.clientHits.set(action.clientId, hits + 1);
        world.state.serverEchoes += 1;
      },
      apply: (m) => {
        m.pings += 1;
      },
    });

    const system = defineSystem<FakeState, PingModel>({
      id: 'fake.demo',
      state: () => ({ serverEchoes: 0, clientHits: new Map() }),
      knobs: [
        defineKnob({
          id: 'clientCount',
          default: 2,
          arb: fc.integer({ min: 1, max: 3 }),
        }),
      ],
      nodes: [
        { kind: fakeServer, role: 'server', count: 1 },
        {
          kind: fakeClient,
          role: 'client',
          count: { fromKnob: 'clientCount' },
          idFor: (i) => `c${i}`,
        },
      ],
      actions: [ping],
      model: {
        initial: (): PingModel => ({ pings: 0 }),
      },
      settle: async (world) => {
        world.healAll();
        await world.idle();
      },
      invariants: async () => null,
    });

    await using world = await openWorld(system, {
      seed: 42,
      knobs: { clientCount: 2 },
    });
    expect(world.roleIds('client')).toEqual(['c0', 'c1']);
    expect(world.node('server').id).toBe('server');
    world.partition('c0', 'server');
    expect(world.network.isEdgePartitioned('cli:c0', 'srv:server')).toBe(true);
    world.healAll();

    const { world: w2 } = await replay(system, {
      seed: 7,
      knobs: { clientCount: 2 },
      actions: [{ kind: 'ping', clientId: 'c0' }],
    });
    expect(w2.state.serverEchoes).toBe(1);
    expect(w2.state.clientHits.get('c0')).toBe(1);
    await w2.dispose();
  });

  test('assertSample runs joint knob + action pool', async () => {
    const solo = defineNodeKind({
      id: 'fake.solo',
      boot: (ctx) => ({ id: ctx.nodeId }),
    });
    const tick = defineAction({
      kind: 'tick',
      class: 'library',
      arb: () => fc.constant({ kind: 'tick' as const }),
      dispatch: async () => {
        /* noop */
      },
    });
    const system = defineSystem({
      id: 'fake.solo',
      knobs: [
        defineKnob({
          id: 'n',
          default: 1,
          arb: fc.constant(1),
        }),
      ],
      nodes: [{ kind: solo, role: 'peer', count: 1 }],
      actions: [tick],
      model: { initial: () => ({}) },
      settle: async () => {
        /* noop */
      },
      invariants: async () => null,
    });
    await assertSample(system, { maxCommands: 3, numRuns: 2 });
  });
});
