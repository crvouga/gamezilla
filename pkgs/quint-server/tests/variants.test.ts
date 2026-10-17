/**
 * A host can replay a model once per variant it defines (one per subject the
 * model holds for): every variant replays the traces that take every bound
 * action, each pinned history and the determinism check, each run in its own
 * world and recording its own verdict; an exploring run deals the other
 * traces out among the variants in turn.
 */

import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readEvidence } from '@pkgs/conformance-server/evidence-store';
import { runQuintModel } from '@pkgs/quint-server/bun-test';
import { simulate } from '@pkgs/quint-server/simulate';
import {
  runContext,
  runInSlice,
  runName,
  runObligation,
  runsOfTrace,
} from '@pkgs/quint-server/trace-runs';
import type { QuintBinding, TraceContext } from '@pkgs/quint-shared/registry';
import {
  bindQuintModel,
  defineTraceVariants,
  setQuintWorld,
} from '@pkgs/quint-shared/registry';
import { replayCover } from '@pkgs/quint-shared/replay-budget';
import lockedDoorTrace from './fixtures/door-locked.itf.json';

type Door = {
  state: string;
  lastBy: string;
  readonly ctx: TraceContext;
};

const MODEL = 'door-variants';
const FIXTURE = join(import.meta.dir, `fixtures/${MODEL}.qnt`);
const SPEC_URI = `pkgs/quint-server/tests/fixtures/${MODEL}.qnt`;
const TRACES = 6;
const MAX_STEPS = 8;
const VARIANTS = [
  { id: 'first', label: 'the first subject' },
  { id: 'second', label: 'the second subject' },
] as const;

const who = (picks: Readonly<Record<string, unknown>>) => String(picks['who']);
const act =
  (state: string) =>
  async (d: Door, picks: Readonly<Record<string, unknown>>) => {
    d.state = state;
    d.lastBy = who(picks);
  };

const binding: QuintBinding<Door> = {
  model: MODEL,
  traces: TRACES,
  maxSteps: MAX_STEPS,
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
    open: act('open'),
    close: act('closed'),
    lock: act('locked'),
    unlock: act('closed'),
    _loseConnection: async () => {},
    _connectionReturns: async () => {},
  },
  observe: async (d) => ({ state: d.state, lastBy: d.lastBy }),
  fingerprint: async (d) => `${d.state}:${d.lastBy}`,
};

const worlds: TraceContext[] = [];
setQuintWorld<Door>({
  create: async (ctx) => {
    worlds.push(ctx);
    return { state: 'closed', lastBy: '', ctx };
  },
  dispose: async () => {},
});
defineTraceVariants(({ model }) => (model === MODEL ? VARIANTS : null));
bindQuintModel(binding);

const OUT = mkdtempSync(join(tmpdir(), 'quint-variants-'));
afterAll(() => rmSync(OUT, { recursive: true, force: true }));

// An exploring run: every drawn trace is replayed, for some variant.
runQuintModel({
  packageName: '@pkgs/quint',
  specPath: FIXTURE,
  specUri: SPEC_URI,
  reportDir: OUT,
  replayTraces: Number.POSITIVE_INFINITY,
});

describe('a model its host varies', () => {
  const drawn = simulate({
    specPath: FIXTURE,
    traces: TRACES,
    maxSteps: MAX_STEPS,
    outDir: join(OUT, 'redraw'),
  });
  const cover = replayCover(drawn.traces, Object.keys(binding.actions));

  test('every variant replays the cover, its pinned history and the determinism check', () => {
    const obligations = readEvidence(OUT)
      .records.filter((record) => record.specUri === SPEC_URI)
      .flatMap((record) => record.obligations);
    const ids = new Set(obligations.map((o) => o.id));
    for (const variant of VARIANTS) {
      for (const i of cover)
        expect(ids.has(`trace:${String(i + 1)} [${variant.id}]`)).toBe(true);
      expect(ids.has(`regression:locked-door [${variant.id}]`)).toBe(true);
      expect(ids.has(`determinism [${variant.id}]`)).toBe(true);
    }
    expect(obligations.filter((o) => o.status !== 'pass')).toEqual([]);
    // A varied run never records an unvaried verdict another run could take.
    expect(
      [...ids].filter((id) => /^(trace:\d+|determinism)$/.test(id))
    ).toEqual([]);
  });

  test('the other drawn traces are dealt out among the variants in turn', () => {
    const ids = new Set(
      readEvidence(OUT)
        .records.filter((record) => record.specUri === SPEC_URI)
        .flatMap((record) => record.obligations.map((o) => o.id))
    );
    for (const i of drawn.traces.keys()) {
      if (cover.has(i)) continue;
      const replayedFor = VARIANTS.filter((variant) =>
        ids.has(`trace:${String(i + 1)} [${variant.id}]`)
      ).map((variant) => variant.id);
      expect(replayedFor).toEqual([VARIANTS[i % VARIANTS.length]!.id]);
    }
  });

  test('each run opens its own world, named for its variant', () => {
    const traceWorlds = worlds.filter((ctx) => ctx.model === MODEL);
    expect(traceWorlds.length).toBeGreaterThan(0);
    for (const ctx of traceWorlds) {
      expect(VARIANTS.map((variant): string => variant.id)).toContain(
        ctx.variant?.id ?? 'none'
      );
      expect(ctx.testId.endsWith(`.${ctx.variant!.id}`)).toBe(true);
      expect(ctx.title.endsWith(`[${ctx.variant!.label}]`)).toBe(true);
    }
  });
});

describe('the runs of one trace', () => {
  const runs = VARIANTS.map((variant) => ({ variant }));
  const ctx: TraceContext = {
    packageName: '@pkgs/quint',
    specUri: SPEC_URI,
    model: MODEL,
    trace: 3,
    seed: '0x2a',
    testId: `${MODEL}.trace-3`,
    title: `${MODEL} · trace 3`,
  };

  test('an unvaried model replays each trace once, as before', () => {
    expect(runsOfTrace(4, [{}], new Set())).toEqual([{}]);
    expect(runContext(ctx, {})).toBe(ctx);
    expect(runName('trace 3 (2 steps)', {})).toBe('trace 3 (2 steps)');
    expect(runObligation('trace:3', {})).toBe('trace:3');
  });

  test('a covering trace runs for every variant, any other for one in turn', () => {
    expect(runsOfTrace(1, runs, new Set([1]))).toEqual(runs);
    expect(runsOfTrace(2, runs, new Set([1]))).toEqual([runs[0]!]);
    expect(runsOfTrace(3, runs, new Set([1]))).toEqual([runs[1]!]);
  });

  test('an unvaried model slices by test, as before', () => {
    for (let test = 0; test < 20; test++)
      for (let index = 0; index < 8; index++)
        expect(runInSlice(test, 0, 1, { index, count: 8 })).toBe(
          test % 8 === index
        );
  });

  test("a varied model's runs are dealt out among the slices one by one", () => {
    const count = 8;
    const slicesOf = (test: number, run: number) =>
      Array.from({ length: count }, (_, index) => index).filter((index) =>
        runInSlice(test, run, 3, { index, count })
      );
    const load = Array.from({ length: count }, () => 0);
    for (let test = 0; test < 12; test++)
      for (let run = 0; run < 3; run++) {
        const slices = slicesOf(test, run);
        // Every run is in exactly one slice.
        expect(slices).toHaveLength(1);
        load[slices[0]!]! += 1;
      }
    // A test's three runs land in three slices, and no slice takes more
    // than its share of the 36 runs.
    expect(new Set([0, 1, 2].map((run) => slicesOf(5, run)[0])).size).toBe(3);
    expect(Math.max(...load) - Math.min(...load)).toBeLessThanOrEqual(1);
  });

  test('a variant run names its variant in its test, world and verdict', () => {
    const run = runs[1]!;
    expect(runContext(ctx, run)).toMatchObject({
      variant: VARIANTS[1],
      testId: `${MODEL}.trace-3.second`,
      title: `${MODEL} · trace 3 [the second subject]`,
    });
    expect(runName('trace 3 (2 steps)', run)).toBe(
      'trace 3 (2 steps) [the second subject]'
    );
    expect(runObligation('trace:3', run)).toBe('trace:3 [second]');
  });
});
