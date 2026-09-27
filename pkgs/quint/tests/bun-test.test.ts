/**
 * The bridge end to end: a model's traces replayed against an in-memory door
 * that agrees with it, and a door that does not.
 */

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { runQuintModel } from '@pkgs/quint/bun-test';
import {
  bindQuintModel,
  type QuintBinding,
  setQuintWorld,
} from '@pkgs/quint/registry';
import { replayTrace, untakenActions } from '@pkgs/quint/replay';
import { simulate } from '@pkgs/quint/simulate';

type Door = { state: string; lastBy: string; steps: string[] };

const who = (picks: Readonly<Record<string, unknown>>) => String(picks['who']);

const binding: QuintBinding<Door> = {
  model: 'door',
  traces: 6,
  maxSteps: 8,
  actions: {
    init: async () => {},
    open: async (d, picks) => {
      d.state = 'open';
      d.lastBy = who(picks);
    },
    close: async (d, picks) => {
      d.state = 'closed';
      d.lastBy = who(picks);
    },
    lock: async (d, picks) => {
      d.state = 'locked';
      d.lastBy = who(picks);
    },
    unlock: async (d, picks) => {
      d.state = 'closed';
      d.lastBy = who(picks);
    },
  },
  observe: async (d) => ({ state: d.state, lastBy: d.lastBy }),
};

setQuintWorld<Door>({
  create: async () => ({ state: 'closed', lastBy: '', steps: [] }),
  dispose: async () => {},
  record: async (d, meta, fn) => {
    d.steps.push(meta.title);
    return await fn();
  },
});
bindQuintModel(binding);

const FIXTURE = join(import.meta.dir, 'fixtures/door.qnt');
const OUT = join(import.meta.dir, '../.cache/test-traces');

runQuintModel({
  packageName: '@pkgs/quint',
  specPath: FIXTURE,
  specUri: 'pkgs/quint/tests/fixtures/door.qnt',
  reportDir: OUT,
});

describe('a product that disagrees with the model', () => {
  const drawn = simulate({
    specPath: FIXTURE,
    seed: '0x2a',
    traces: 6,
    maxSteps: 8,
    outDir: join(OUT, 'disagree'),
  });
  // A lock that never latches: the door stays closed.
  const stuck: QuintBinding<Door> = {
    ...binding,
    actions: { ...binding.actions, lock: async () => {} },
  };
  const withLock = drawn.traces.find((t) =>
    t.states.some((s) => s.action === 'lock')
  );

  test('fails at the first step the product disagrees, naming the variable', async () => {
    expect(withLock).toBeDefined();
    if (withLock === undefined) return;
    const lockAt = withLock.states.findIndex((s) => s.action === 'lock');
    const world = {
      create: async () => ({ state: 'closed', lastBy: '', steps: [] }),
      dispose: async () => {},
    };
    const replay = replayTrace({
      ctx: {
        packageName: '@pkgs/quint',
        specUri: 'door.qnt',
        model: 'door',
        trace: 1,
        seed: '0x2a',
        testId: 'door.trace-1',
        title: 'door · trace 1',
      },
      trace: withLock,
      world,
      binding: stuck as QuintBinding<unknown>,
    });
    await expect(replay).rejects.toThrow(
      `step:    ${String(lockAt)} lock(who:`
    );
    await expect(replay).rejects.toThrow(
      /state\n\s+model: {3}"locked"\n\s+product: "closed"/
    );
  });

  test('an action the model can take but the binding lacks fails the trace', async () => {
    const { lock: _lock, ...rest } = binding.actions;
    const partial: QuintBinding<Door> = { ...binding, actions: rest };
    if (withLock === undefined) return;
    await expect(
      replayTrace({
        ctx: {
          packageName: '@pkgs/quint',
          specUri: 'door.qnt',
          model: 'door',
          trace: 1,
          seed: '0x2a',
          testId: 'door.trace-1',
          title: 'door · trace 1',
        },
        trace: withLock,
        world: {
          create: async () => ({ state: 'closed', lastBy: '', steps: [] }),
          dispose: async () => {},
        },
        binding: partial as QuintBinding<unknown>,
      })
    ).rejects.toThrow('no binding for Quint action "lock"');
  });

  test('a bound action no trace takes is reported', () => {
    const extra: QuintBinding<Door> = {
      ...binding,
      actions: { ...binding.actions, knock: async () => {} },
    };
    expect(
      untakenActions(extra as QuintBinding<unknown>, drawn.traces)
    ).toEqual(['knock']);
  });
});
