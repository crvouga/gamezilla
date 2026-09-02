import { describe, expect, test } from 'bun:test';
import fc from 'fast-check';
import { action } from './action';
import type { AnySystemDef } from './define-system';
import { defineSystem } from './define-system';
import { knob } from './knobs';
import { node } from './node';
import { assertSample, replay } from './pbt';
import { openWorld } from './world';

type PingModel = { pings: number };

type PingAction = {
  readonly kind: 'ping';
  readonly clientId: string;
};

type FakeServerHandle = { readonly id: string };
type FakeClientHandle = { readonly id: string };

type DemoWorld = {
  readonly nodes: {
    readonly server: FakeServerHandle;
    readonly client: ReadonlyMap<string, FakeClientHandle>;
  };
  serverEchoes: number;
  clientHits: Map<string, number>;
};

describe('defineSystem framework world', () => {
  test('boots topology, action dispatch, settle', async () => {
    const fakeServer = node({
      boot: (ctx) => {
        ctx.listen(async () => {
          /* noop */
        }, `srv:${ctx.id}`);
        return { id: ctx.id };
      },
    });
    const fakeClient = node({
      boot: (ctx) => {
        ctx.listen(async () => {
          /* noop */
        }, `cli:${ctx.id}`);
        return { id: ctx.id };
      },
    });

    const ping = action<PingAction, PingModel, DemoWorld>({
      arb: (ctx) =>
        fc.constantFrom(...ctx.ids('client')).map((clientId) => ({
          kind: 'ping' as const,
          clientId,
        })),
      dispatch: async (world, a) => {
        const hits = world.clientHits.get(a.clientId) ?? 0;
        world.clientHits.set(a.clientId, hits + 1);
        world.serverEchoes += 1;
      },
      apply: (m) => {
        m.pings += 1;
      },
    });

    const system = defineSystem({
      id: 'fake.demo',
      knobs: {
        clientCount: knob(2, fc.integer({ min: 1, max: 3 })),
      },
      nodes: {
        server: fakeServer,
        client: {
          ...fakeClient,
          count: (k) => k['clientCount'] as number,
          id: (i) => `c${i}`,
        },
      },
      actions: { ping },
      model: {
        initial: (): PingModel => ({ pings: 0 }),
      },
      extend: () => ({
        serverEchoes: 0,
        clientHits: new Map<string, number>(),
      }),
      settle: async (world) => {
        world.healAll();
        await world.idle();
      },
      invariants: async () => {
        /* noop */
      },
    });

    await using world = await openWorld(system, {
      seed: 42,
      knobs: { clientCount: 2 },
    });
    expect(world.ids('client')).toEqual(['c0', 'c1']);
    expect((world.nodes as unknown as DemoWorld['nodes']).server.id).toBe(
      'server'
    );
    world.partition('c0', 'server');
    expect(world.network.isPartitioned('cli:c0', 'srv:server')).toBe(true);
    world.healAll();

    const { world: w2 } = await replay(system as unknown as AnySystemDef, {
      seed: 7,
      knobs: { clientCount: 2 },
      actions: [{ kind: 'ping', clientId: 'c0' }],
    });
    const demo = w2 as unknown as DemoWorld;
    expect(demo.serverEchoes).toBe(1);
    expect(demo.clientHits.get('c0')).toBe(1);
    await w2.dispose();
  });

  test('assertSample runs joint knob + action pool', async () => {
    const solo = node({
      boot: (ctx) => ({ id: ctx.id }),
    });
    const tick = action({
      arb: () => fc.constant({ kind: 'tick' as const }),
      dispatch: async () => {
        /* noop */
      },
    });
    const system = defineSystem({
      id: 'fake.solo',
      knobs: {
        n: knob(1, fc.constant(1)),
      },
      nodes: { peer: solo },
      actions: { tick },
      model: { initial: () => ({}) },
      settle: async () => {
        /* noop */
      },
      invariants: async () => {
        /* noop */
      },
    });
    await assertSample(system as unknown as AnySystemDef, {
      maxCommands: 3,
      numRuns: 2,
    });
  });
});
