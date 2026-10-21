/**
 * The bridge end to end: a model's traces replayed against an in-memory door
 * that agrees with it, and a door that does not.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { readEvidence } from '@pkgs/conformance-server-ts/evidence-store';
import { runQuintModel } from '@pkgs/quint-server-ts/bun-test';
import { simulate } from '@pkgs/quint-server-ts/simulate';
import type { QuintBinding } from '@pkgs/quint-shared-ts/registry';
import { bindQuintModel, setQuintWorld } from '@pkgs/quint-shared-ts/registry';
import {
  replayTrace,
  replayTraceTwice,
  untakenActions,
} from '@pkgs/quint-shared-ts/replay';
import { replaySelection } from '@pkgs/quint-shared-ts/replay-budget';
import { DEFAULT_REPLAY_TRACES } from '@pkgs/quint-shared-ts/wall';
import lockedDoorTrace from './fixtures/door-locked.itf.json';

type Door = { state: string; lastBy: string; steps: string[] };

const who = (picks: Readonly<Record<string, unknown>>) => String(picks['who']);

const binding: QuintBinding<Door> = {
  model: 'door',
  traces: 6,
  maxSteps: 8,
  regressions: [
    {
      id: 'locked-door',
      title: 'A pinned lock and unlock history agrees with the product',
      seed: '0x2a',
      itf: lockedDoorTrace,
    },
  ],
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
    _loseConnection: async () => {},
    _connectionReturns: async () => {},
  },
  observe: async (d) => ({ state: d.state, lastBy: d.lastBy }),
  fingerprint: async (d) => `${d.state}:${d.lastBy}`,
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
const SPEC_URI = 'pkgs/quint-server-ts/tests/fixtures/door.qnt';

// Evidence merges across runs of the same model text; start from none.
rmSync(join(OUT, 'evidence'), { recursive: true, force: true });

// An exploring run: every drawn trace is replayed.
runQuintModel({
  packageName: '@pkgs/quint',
  specPath: FIXTURE,
  specUri: SPEC_URI,
  reportDir: OUT,
  replayTraces: Number.POSITIVE_INFINITY,
});

// Registered after the model's tests, so it runs once they have decided.
describe('evidence of the model run', () => {
  test('records every obligation the run decided, each passing', () => {
    const { records, malformed } = readEvidence(OUT);
    expect(malformed).toEqual([]);
    const door = records.find((r) => r.specUri === SPEC_URI);
    expect(door).toMatchObject({
      kind: 'dynamics',
      packageName: '@pkgs/quint',
      specSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const byId = new Map(door?.obligations.map((o) => [o.id, o]));
    const layers = Object.fromEntries(
      [...byId].map(([id, o]) => [id.replace(/:\d+$/, ':n'), o.layer])
    );
    expect(layers).toEqual({
      shape: 'specification',
      typecheck: 'specification',
      simulate: 'specification',
      'bound-actions': 'completeness',
      determinism: 'implementation',
      'trace:n': 'implementation',
      'regression:locked-door': 'implementation',
    });
    expect(byId.has('trace:1')).toBe(true);
    expect([...byId.values()].filter((o) => o.status !== 'pass')).toEqual([]);
  });
});

const BUDGETED = join(import.meta.dir, '../.cache/test-traces-budgeted');
rmSync(join(BUDGETED, 'evidence'), { recursive: true, force: true });

// regression: quint-budget-fixture-inherits-nightly-replays
// This example checks the minimum budget even when the suite explores all traces.
runQuintModel({
  packageName: '@pkgs/quint',
  specPath: FIXTURE,
  specUri: SPEC_URI,
  reportDir: BUDGETED,
  replayTraces: DEFAULT_REPLAY_TRACES,
});

describe('evidence of a model run that does not explore', () => {
  test('judges the whole draw and replays only the traces that take every bound action', () => {
    const summary = JSON.parse(
      readFileSync(join(BUDGETED, 'quint/door/model.json'), 'utf8')
    ) as { traces: unknown[]; replayed: number[] };
    const drawn = simulate({
      specPath: FIXTURE,
      traces: 6,
      maxSteps: 8,
      outDir: join(BUDGETED, 'redraw'),
    });
    const selected = [
      ...replaySelection(
        drawn.traces,
        Object.keys(binding.actions),
        DEFAULT_REPLAY_TRACES
      ),
    ]
      .sort((a, b) => a - b)
      .map((index) => index + 1);
    // Fewer than were drawn, or the run was not bounded.
    expect(selected.length).toBeLessThan(drawn.traces.length);
    expect(summary.traces).toHaveLength(drawn.traces.length);
    expect(summary.replayed).toEqual(selected);
    const door = readEvidence(BUDGETED).records.find(
      (r) => r.specUri === SPEC_URI
    );
    const byId = new Map(door?.obligations.map((o) => [o.id, o]));
    expect(
      [...byId.keys()]
        .filter((id) => id.startsWith('trace:'))
        .map((id) => Number(id.slice('trace:'.length)))
        .sort((a, b) => a - b)
    ).toEqual(selected);
    // The model-wide obligations and the pinned history are not budgeted.
    for (const id of [
      'simulate',
      'bound-actions',
      'determinism',
      'regression:locked-door',
    ])
      expect(byId.get(id)?.status).toBe('pass');
    expect(byId.get('bound-actions')?.detail).toContain('_loseConnection');
    // regression: replay-budget-moves-determinism-trace
    // The budget does not choose the trace determinism is decided on.
    const explored = readEvidence(OUT)
      .records.find((r) => r.specUri === SPEC_URI)
      ?.obligations.find((o) => o.id === 'determinism');
    expect(explored?.detail).toMatch(/^trace \d+ replayed twice/);
    expect(byId.get('determinism')?.detail).toBe(explored?.detail);
  });
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

  test('a correct observed field cannot conceal an unread public promise', async () => {
    // regression: quint-public-state-not-observed
    if (withLock === undefined) throw new Error('no lock trace');
    await expect(
      replayTrace({
        ctx: {
          packageName: '@pkgs/quint',
          specUri: 'door.qnt',
          model: 'door',
          trace: 1,
          seed: '0x2a',
          testId: 'door.partial',
          title: 'door partial',
        },
        trace: withLock,
        world: {
          create: async () => ({ state: 'closed', lastBy: '', steps: [] }),
          dispose: async () => {},
        },
        binding: {
          ...binding,
          observe: async (d: Door) => ({ state: d.state }),
        } as QuintBinding<unknown>,
      })
    ).rejects.toThrow('observe did not read public variables: lastBy');
  });

  test('a world whose end state depends on more than the trace fails the replay-twice check', async () => {
    if (withLock === undefined) return;
    let opened = 0;
    const leaky: QuintBinding<Door> = {
      ...binding,
      fingerprint: async (d) => `${d.state}:${String(opened)}`,
    };
    const args = {
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
        create: async () => {
          opened += 1;
          return { state: 'closed', lastBy: '', steps: [] };
        },
        dispose: async () => {},
      },
    };
    await expect(
      replayTraceTwice({ ...args, binding: leaky as QuintBinding<unknown> })
    ).rejects.toThrow('replayed twice ended in different states');
    const sound: QuintBinding<Door> = {
      ...binding,
      fingerprint: async (d) => `${d.state}:${d.lastBy}`,
    };
    await replayTraceTwice({
      ...args,
      binding: sound as QuintBinding<unknown>,
    });
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
