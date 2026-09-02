import { describe, expect, test } from 'bun:test';
import fc from 'fast-check';
import { check, replay } from '../pbt';
import { actions } from './actions';
import type { AnyScenarioDef } from './define-scenario';
import { defineScenario } from './define-scenario';
import { knob } from './knobs';
import { node, nodeCount } from './node';
import { properties, property } from './property';
import { openWorld } from './world';

type DemoKnobs = {
  readonly clientCount: ReturnType<typeof knob<number>>;
};

type DemoSurface = {
  serverEchoes: number;
  clientHits: Map<string, number>;
  readonly nodes: {
    readonly server: FakeServerHandle;
    readonly client: ReadonlyMap<string, FakeClientHandle>;
  };
  nodeIds(role: string): readonly string[];
  partition(a: string, b: string): Disposable;
  healAll(): void;
  advance(ms: number): Promise<void>;
  quiesce(): Promise<void>;
};

type FakeServerHandle = { readonly id: string };
type FakeClientHandle = { readonly id: string };

describe('defineScenario framework world', () => {
  test('starts topology, applies actions, converges', async () => {
    const fakeServer = node({
      start: (ctx) => {
        ctx.listen(async () => {
          /* noop */
        }, `srv:${ctx.id}`);
        return { id: ctx.id };
      },
    });
    const fakeClient = node({
      start: (ctx) => {
        ctx.listen(async () => {
          /* noop */
        }, `cli:${ctx.id}`);
        return { id: ctx.id };
      },
    });

    const pingActions = actions<DemoSurface>()({
      ping: {
        generate: (ctx) =>
          fc.constantFrom(...ctx.nodeIds('client')).map((clientId) => ({
            kind: 'ping' as const,
            clientId,
          })),
        apply: async (surface, payload) => {
          const action = payload as { readonly clientId: string };
          const hits = surface.clientHits.get(action.clientId) ?? 0;
          surface.clientHits.set(action.clientId, hits + 1);
          surface.serverEchoes += 1;
        },
      },
    });

    const scenario = defineScenario({
      id: 'fake.demo',
      knobs: {
        clientCount: knob(2, fc.integer({ min: 1, max: 3 })),
      },
      nodes: {
        server: fakeServer,
        client: {
          ...fakeClient,
          count: nodeCount<DemoKnobs>((k) => k.clientCount),
          id: (i) => `c${i}`,
        },
      },
      actions: pingActions as import('./actions').ActionCatalog<DemoSurface>,
      properties: properties<DemoSurface>()({
        noop: property.always(async () => true),
      }),
      extend: () => ({
        serverEchoes: 0,
        clientHits: new Map<string, number>(),
      }),
      converge: async (world) => {
        world.healAll();
        await world.quiesce();
      },
    } as AnyScenarioDef);

    {
      await using world = await openWorld(scenario, {
        seed: 42,
        knobs: { clientCount: 2 },
      });
      expect(world.nodeIds('client')).toEqual(['c0', 'c1']);
      expect((world.nodes as unknown as DemoSurface['nodes']).server.id).toBe(
        'server'
      );
      world.partition('c0', 'server');
      expect(world.network.isPartitioned('cli:c0', 'srv:server')).toBe(true);
      world.healAll();
    }

    const { world: w2 } = await replay(scenario as unknown as AnyScenarioDef, {
      seed: 7,
      knobs: { clientCount: 2 },
      actions: [{ kind: 'ping', clientId: 'c0' }],
    });
    const demo = w2 as unknown as DemoSurface;
    expect(demo.serverEchoes).toBe(1);
    expect(demo.clientHits.get('c0')).toBe(1);
    await w2.dispose();
  });

  test('check samples joint knob + action pool', async () => {
    const solo = node({
      start: (ctx) => ({ id: ctx.id }),
    });
    const tickActions = actions<{ readonly id: string }>()({
      tick: {
        generate: () => fc.constant({ kind: 'tick' as const }),
        apply: async () => {
          /* noop */
        },
      },
    });
    const scenario = defineScenario({
      id: 'fake.solo',
      knobs: {
        n: knob(1, fc.constant(1)),
      },
      nodes: { peer: solo },
      actions: tickActions,
      properties: properties<{ readonly id: string }>()({
        noop: property.always(async () => true),
      }),
      converge: async () => {
        /* noop */
      },
    });
    await check(scenario as unknown as AnyScenarioDef, {
      episodeLength: 3,
      episodes: 2,
    });
  });
});
