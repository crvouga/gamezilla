/**
 * A spec its host runs once per variant (a shared game specification, once
 * per game) is decided cell by cell: each variant the host declared it needs
 * by a fresh verdict of its own. One game's pass never satisfies another's,
 * a game the spec does not need is not applicable, and a game whose only
 * verdict is from another text of the spec is stale.
 */

import { describe, expect, test } from 'bun:test';
import type {
  EvidenceRecord,
  Obligation,
} from '@pkgs/conformance-shared-ts/evidence';
import type { VariantRequirements } from '@pkgs/conformance-shared-ts/variants';
import { specVariants } from '@pkgs/conformance-shared-ts/variants';
import type { ReportInput, ReportSpec } from '../conformance/evaluate';
import { evaluateLines, evaluateVariantCells } from '../conformance/evaluate';
import type { LineId } from '../conformance/lines';

const GAMES = ['chess', 'connect-four', 'counting-race'];
const SCENARIO = 'Both people see the result';

const FEATURE: ReportSpec = {
  path: 'specs/games/matched-game-results.feature',
  context: 'games',
  kind: 'behavior',
  sha256: 'feature-now',
  bound: true,
  harness: true,
  live: false,
  accessibility: false,
  scenarios: [SCENARIO],
  temporalProperties: [],
};

const MODEL: ReportSpec = {
  ...FEATURE,
  path: 'specs/games/matched-game.qnt',
  kind: 'dynamics',
  sha256: 'model-now',
  scenarios: [],
};

/** The games harness's declaration: chess and Connect Four need both specs. */
const DECLARED: VariantRequirements = {
  packageName: '@libs/games-harness-ts',
  variants: GAMES,
  required: {
    [FEATURE.path]: ['chess', 'connect-four'],
    [MODEL.path]: ['chess', 'connect-four'],
  },
};

const verdict = (
  id: string,
  status: Obligation['status'],
  layer: Obligation['layer'] = 'system'
): Obligation => ({ id, layer, status });

function record(
  spec: ReportSpec,
  obligations: readonly Obligation[],
  sha = spec.sha256
): EvidenceRecord {
  return {
    specUri: spec.path,
    kind: spec.kind,
    specSha256: sha,
    packageName: '@libs/games-harness-ts',
    obligations,
  };
}

function input(
  records: readonly EvidenceRecord[],
  declared: readonly VariantRequirements[] = [DECLARED]
): ReportInput {
  return {
    specs: [FEATURE, MODEL],
    records,
    malformed: [],
    variants: specVariants(declared),
    closure: [],
    capabilities: [],
    gateTasks: [],
    gates: new Map(),
  };
}

function problems(report: ReportInput, id: LineId, spec: ReportSpec) {
  const found = evaluateLines(report).find((l) => l.id === id);
  if (found === undefined) throw new Error(`no line ${id}`);
  return found.problems.filter((problem) => problem.startsWith(spec.path));
}

function cells(report: ReportInput, spec: ReportSpec) {
  return Object.fromEntries(
    evaluateVariantCells(report)
      .filter((cell) => cell.spec === spec.path)
      .map((cell) => [cell.variant, cell.status])
  );
}

const scenario = (game: string) => `scenario:${SCENARIO} [${game}]`;

describe('per-game evidence of a shared feature', () => {
  test("one game's pass does not satisfy another game's requirement", () => {
    const report = input([
      record(FEATURE, [verdict(scenario('chess'), 'pass')]),
    ]);
    expect(problems(report, 'acceptance', FEATURE)).toEqual([
      `${FEATURE.path}: required but missing for connect-four — scenario "${SCENARIO}" has no system verdict`,
    ]);
    expect(cells(report, FEATURE)).toEqual({
      chess: 'passed',
      'connect-four': 'required but missing',
      'counting-race': 'not applicable',
    });
  });

  test('a game the spec does not need is not applicable and owes nothing', () => {
    const report = input([
      record(FEATURE, [
        verdict(scenario('chess'), 'pass'),
        verdict(scenario('connect-four'), 'pass'),
      ]),
    ]);
    expect(problems(report, 'acceptance', FEATURE)).toEqual([]);
    expect(cells(report, FEATURE)['counting-race']).toBe('not applicable');
  });

  test("a game whose only verdict is from another text is stale, whatever another game's fresh one says", () => {
    const report = input([
      record(FEATURE, [verdict(scenario('chess'), 'pass')]),
      record(
        FEATURE,
        [verdict(scenario('connect-four'), 'pass')],
        'feature-before'
      ),
    ]);
    expect(problems(report, 'acceptance', FEATURE)).toEqual([
      `${FEATURE.path}: stale evidence for connect-four — scenario "${SCENARIO}" has no system verdict from the current text, only from another; run its suite again`,
    ]);
    expect(cells(report, FEATURE)['connect-four']).toBe('stale');
  });

  test('a failing game fails its own cell and is named', () => {
    const report = input([
      record(FEATURE, [
        verdict(scenario('chess'), 'pass'),
        verdict(scenario('connect-four'), 'fail'),
      ]),
    ]);
    expect(problems(report, 'acceptance', FEATURE)).toEqual([
      `${FEATURE.path}: ${scenario('connect-four')} failed`,
    ]);
    expect(cells(report, FEATURE)).toMatchObject({
      chess: 'passed',
      'connect-four': 'failed',
    });
  });

  test('a per-game verdict without the host declaring what the spec needs decides nothing', () => {
    const report = input(
      [record(FEATURE, [verdict(scenario('chess'), 'pass')])],
      []
    );
    expect(problems(report, 'acceptance', FEATURE)).toEqual([
      `${FEATURE.path}: not run — scenario "${SCENARIO}" ran per variant, but its host declared no variant it needs`,
    ]);
    expect(cells(report, FEATURE)).toEqual({});
  });

  test('a spec its host requires of no game proves nothing', () => {
    const none: VariantRequirements = {
      ...DECLARED,
      required: { [FEATURE.path]: [] },
    };
    const report = input([record(FEATURE, [])], [none]);
    expect(problems(report, 'acceptance', FEATURE)).toContain(
      `${FEATURE.path}: its host requires no variant to run it — nothing proves it`
    );
  });

  test('declarations from several buckets require every game any of them needs', () => {
    const report = input(
      [record(FEATURE, [verdict(scenario('chess'), 'pass')])],
      [
        { ...DECLARED, required: { [FEATURE.path]: ['chess'] } },
        { ...DECLARED, required: { [FEATURE.path]: ['connect-four'] } },
      ]
    );
    expect(cells(report, FEATURE)['connect-four']).toBe('required but missing');
  });
});

describe('per-game evidence of a shared model', () => {
  const trace = (n: number, game: string) =>
    verdict(`trace:${String(n)} [${game}]`, 'pass', 'implementation');

  test('every required game needs a replayed trace of its own', () => {
    const report = input([
      record(MODEL, [trace(1, 'chess'), trace(2, 'chess')]),
    ]);
    expect(problems(report, 'trace-conformance', MODEL)).toEqual([
      `${MODEL.path}: required but missing for connect-four — no implementation verdict`,
    ]);
    expect(cells(report, MODEL)).toEqual({
      chess: 'passed',
      'connect-four': 'required but missing',
      'counting-race': 'not applicable',
    });
  });

  test('traces dealt out among the games pass when each game replayed its own', () => {
    const report = input([
      record(MODEL, [trace(1, 'chess'), trace(2, 'connect-four')]),
    ]);
    expect(problems(report, 'trace-conformance', MODEL)).toEqual([]);
  });

  test('per-game traces without the host declaring what the model needs decide nothing', () => {
    const report = input([record(MODEL, [trace(1, 'chess')])], []);
    expect(problems(report, 'trace-conformance', MODEL)).toEqual([
      `${MODEL.path}: not run — it ran per variant, but its host declared no variant it needs`,
    ]);
  });

  test("a game's traces from another text of the model are stale", () => {
    const report = input([
      record(MODEL, [trace(1, 'chess')]),
      record(MODEL, [trace(2, 'connect-four')], 'model-before'),
    ]);
    expect(cells(report, MODEL)['connect-four']).toBe('stale');
    expect(problems(report, 'trace-conformance', MODEL)).toEqual([
      `${MODEL.path}: stale evidence for connect-four — no implementation verdict from the current text, only from another; run its suite again`,
    ]);
  });
});
