import { describe, expect, test } from 'bun:test';
import fc from 'fast-check';
import { replay, runScenario } from '../pbt';
import { command } from './command';
import type { AnyScenarioDef } from './define-scenario';
import { defineScenario } from './define-scenario';
import { knob } from './knobs';
import { node } from './node';
import { openWorld } from './world';

type PingModel = { pings: number };

type PingCommand = {
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

describe('defineScenario framework world', () => {
  test('starts topology, applies commands, converges', async () => {
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

    const ping = command<PingCommand, PingModel, DemoWorld>({
      generate: (ctx) =>
        fc.constantFrom(...ctx.nodeIds('client')).map((clientId) => ({
          kind: 'ping' as const,
          clientId,
        })),
      apply: async (world, c) => {
        const hits = world.clientHits.get(c.clientId) ?? 0;
        world.clientHits.set(c.clientId, hits + 1);
        world.serverEchoes += 1;
      },
      applyToModel: (m) => {
        m.pings += 1;
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
          count: (k) => k['clientCount'] as number,
          id: (i) => `c${i}`,
        },
      },
      commands: { ping },
      referenceModel: {
        initial: (): PingModel => ({ pings: 0 }),
      },
      extend: () => ({
        serverEchoes: 0,
        clientHits: new Map<string, number>(),
      }),
      converge: async (world) => {
        world.healAll();
        await world.quiesce();
      },
      always: async () => {
        /* noop */
      },
    });

    await using world = await openWorld(scenario, {
      seed: 42,
      knobs: { clientCount: 2 },
    });
    expect(world.nodeIds('client')).toEqual(['c0', 'c1']);
    expect((world.nodes as unknown as DemoWorld['nodes']).server.id).toBe(
      'server'
    );
    world.partition('c0', 'server');
    expect(world.network.isPartitioned('cli:c0', 'srv:server')).toBe(true);
    world.healAll();

    const { world: w2 } = await replay(scenario as unknown as AnyScenarioDef, {
      seed: 7,
      knobs: { clientCount: 2 },
      commands: [{ kind: 'ping', clientId: 'c0' }],
    });
    const demo = w2 as unknown as DemoWorld;
    expect(demo.serverEchoes).toBe(1);
    expect(demo.clientHits.get('c0')).toBe(1);
    await w2.dispose();
  });

  test('runScenario samples joint knob + command pool', async () => {
    const solo = node({
      start: (ctx) => ({ id: ctx.id }),
    });
    const tick = command({
      generate: () => fc.constant({ kind: 'tick' as const }),
      apply: async () => {
        /* noop */
      },
    });
    const scenario = defineScenario({
      id: 'fake.solo',
      knobs: {
        n: knob(1, fc.constant(1)),
      },
      nodes: { peer: solo },
      commands: { tick },
      referenceModel: { initial: () => ({}) },
      converge: async () => {
        /* noop */
      },
      always: async () => {
        /* noop */
      },
    });
    await runScenario(scenario as unknown as AnyScenarioDef, {
      maxCommands: 3,
      numRuns: 2,
    });
  });
});
