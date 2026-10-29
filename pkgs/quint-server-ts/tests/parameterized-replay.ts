import { afterAll, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readEvidence } from '@pkgs/conformance-server-ts/evidence-store';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { runQuintModel } from '@pkgs/quint-server-ts/bun-test';
import {
  drawModelInstances,
  instancesReplayPlan,
  modelInstances,
} from '@pkgs/quint-server-ts/model-instances';
import { sliceReplays } from '@pkgs/quint-server-ts/trace-runs';
import {
  bindQuintModel,
  type QuintBinding,
  type TraceContext,
  type TraceVariant,
} from '@pkgs/quint-shared-ts/registry';
import { DEFAULT_REPLAY_TRACES } from '@pkgs/quint-shared-ts/wall';
import lockedHistory from './fixtures/parameterized-locked.itf.json';
import unlockedHistory from './fixtures/parameterized-unlocked.itf.json';

type Door = { locked: boolean; online: boolean };
const MODEL = 'parameterized-door';
const SPEC_URI = `pkgs/quint-server-ts/tests/fixtures/${MODEL}.qnt`;
const FIXTURE = join(import.meta.dir, `fixtures/${MODEL}.qnt`);

/** Uses the suite's single registered host and world; no second global registry. */
export function registerParameterizedReplays(host: {
  readonly variants: readonly TraceVariant[];
  readonly worlds: readonly TraceContext[];
  readonly setVariants: (variants: readonly TraceVariant[]) => void;
}): void {
  const out = mkdtempSync(join(tmpdir(), 'quint-parameters-'));
  afterAll(() => removeTree(out, { whenLocked: 'leave' }));
  const binding: QuintBinding<Door> = {
    model: MODEL,
    traces: 16,
    maxSteps: 12,
    regressions: [
      {
        id: 'unlocked-input',
        title: 'A history from the unlocked input',
        seed: '0x67932',
        parameters: { LOCKED: false },
        itf: unlockedHistory,
      },
      {
        id: 'locked-input',
        title: 'A history from the locked input',
        seed: '0x67932',
        parameters: { LOCKED: true },
        itf: lockedHistory,
      },
    ],
    actions: {
      init: async () => {},
      toggle: async (door) => {
        door.locked = !door.locked;
      },
      _loseConnection: async (door) => {
        door.online = false;
      },
      _connectionReturns: async (door) => {
        door.online = true;
      },
    },
    observe: async (door) => ({ locked: door.locked, online: door.online }),
    fingerprint: async (door) =>
      `${String(door.locked)}:${String(door.online)}`,
  };
  bindQuintModel(binding);
  for (const index of [0, 1])
    runQuintModel({
      packageName: '@pkgs/quint-server-ts',
      specPath: FIXTURE,
      specUri: SPEC_URI,
      reportDir: out,
      slice: { index, count: 2 },
      replayTraces: DEFAULT_REPLAY_TRACES,
    });
  registerChecks({ host, out, binding: binding as QuintBinding<unknown> });
}

function registerChecks(input: {
  readonly host: Parameters<typeof registerParameterizedReplays>[0];
  readonly out: string;
  readonly binding: QuintBinding<unknown>;
}): void {
  const { host, out, binding } = input;
  const instances = drawModelInstances({
    specPath: FIXTURE,
    specUri: SPEC_URI,
    model: MODEL,
    binding,
    outDir: join(out, 'plan'),
  });
  test('every subject has its own cover and each draw its own evidence', () => {
    const obligations = readEvidence(out).records.flatMap(
      (record) => record.obligations
    );
    expect(obligations.filter((item) => item.status !== 'pass')).toEqual([]);
    const ids = new Set(obligations.map((item) => item.id));
    for (const instance of instances)
      for (const run of instance.runs) {
        const plan = instancesReplayPlan([instance], binding);
        if (!('instances' in plan))
          throw new Error('Missing parameterized replay plan');
        for (const index of plan.instances[0]!.plan.cover)
          expect(
            ids.has(`trace:${String(index + 1)} [${run.variant!.id}]`)
          ).toBe(true);
        expect(ids.has(`determinism [${run.variant!.id}]`)).toBe(true);
      }
    expect(ids.has('simulate (LOCKED=false)')).toBe(true);
    expect(ids.has('simulate (LOCKED=true)')).toBe(true);
  });
  test('planning counts the actual replay workload in both slices', () => {
    expect(instances.map((instance) => instance.runs.length)).toEqual([2, 1]);
    const plan = instancesReplayPlan(instances, binding);
    const planned = [0, 1].reduce(
      (count, index) => count + sliceReplays(plan, 'pr', { index, count: 2 }),
      0
    );
    expect(planned).toBe(
      host.worlds.filter((ctx) => ctx.model === MODEL).length
    );
    expect(planned).toBeGreaterThanOrEqual(9);
  });
  registerScopeChecks(input, instances);
  test('missing parameters and duplicate subjects cannot silently share another verdict', () => {
    try {
      host.setVariants([{ id: 'missing', label: 'missing' }]);
      expect(() =>
        modelInstances({ specPath: FIXTURE, specUri: SPEC_URI, model: MODEL })
      ).toThrow('assign exactly');
      host.setVariants([host.variants[0]!, host.variants[0]!]);
      expect(() =>
        modelInstances({ specPath: FIXTURE, specUri: SPEC_URI, model: MODEL })
      ).toThrow('duplicate model variant');
    } finally {
      host.setVariants(host.variants);
    }
  });
}

function registerScopeChecks(
  input: Parameters<typeof registerChecks>[0],
  instances: ReturnType<typeof drawModelInstances>
): void {
  const { host, out, binding } = input;
  test('each scoped history runs only for its matching input and contributes to its plan', () => {
    const ids = new Set(
      readEvidence(out).records.flatMap((record) =>
        record.obligations.map((item) => item.id)
      )
    );
    for (const variant of host.variants) {
      const selected = variant.parameters?.['LOCKED']
        ? 'locked-input'
        : 'unlocked-input';
      const other =
        selected === 'locked-input' ? 'unlocked-input' : 'locked-input';
      expect(ids.has(`regression:${selected} [${variant.id}]`)).toBe(true);
      expect(ids.has(`regression:${other} [${variant.id}]`)).toBe(false);
    }
    const plan = instancesReplayPlan(instances, binding);
    if (!('instances' in plan)) throw new Error('Missing parameter instances');
    expect(plan.instances.map((instance) => instance.plan.regressions)).toEqual(
      [1, 1]
    );
  });
  test('unsupported scopes fail before drawing any histories', () => {
    try {
      host.setVariants([host.variants[0]!]);
      expect(() =>
        drawModelInstances({
          specPath: FIXTURE,
          specUri: SPEC_URI,
          model: MODEL,
          binding,
          outDir: join(out, 'unsupported'),
        })
      ).toThrow('no registered model case');
    } finally {
      host.setVariants(host.variants);
    }
  });
}
