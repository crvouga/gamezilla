/**
 * The verdict of the conformance pipeline from recorded evidence — pure, so
 * the report script only gathers files and the rules here are unit-tested.
 *
 * Evidence is fresh when it was produced from the spec's current text
 * (`specSha256`); a spec whose only evidence is from another text is stale,
 * and a spec with none is missing — both fail. Fresh records of one spec from
 * several report buckets are merged; when two disagree on one obligation the
 * failure wins, since nothing records which ran last.
 */

import type {
  EvidenceRecord,
  Layer,
  Obligation,
  SpecKind,
} from '@pkgs/conformance/evidence';

import {
  type EvidenceRule,
  LINES,
  type LineId,
  type Rule,
  SERVER_AGREEMENT,
} from './lines';

export type ReportSpec = {
  readonly path: string;
  readonly context: string;
  readonly kind: SpecKind;
  /** sha256 of the spec's current text. */
  readonly sha256: string;
  readonly bound: boolean;
  readonly harness: boolean;
  readonly live: boolean;
  readonly accessibility: boolean;
  /** Behavior: the scenario names of the current text. */
  readonly scenarios: readonly string[];
};

export type TaskVerdict = {
  readonly status: 'pass' | 'fail';
  readonly detail: string;
};

export type ReportInput = {
  readonly specs: readonly ReportSpec[];
  readonly records: readonly EvidenceRecord[];
  /** Evidence files that did not parse. */
  readonly malformed: readonly string[];
  /** What `//#ci:conformance` finds wrong (empty: the world is closed). */
  readonly closure: readonly string[];
  readonly capabilities: readonly {
    readonly id: string;
    readonly decision: string;
    readonly specUri: string;
  }[];
  /** The release gates' checks, and what the build cache says of each. */
  readonly gateTasks: readonly string[];
  readonly gates: ReadonlyMap<string, TaskVerdict>;
};

export type LineResult = {
  readonly id: LineId;
  readonly section: Layer;
  readonly label: string;
  readonly status: 'pass' | 'fail';
  readonly passed: number;
  readonly total: number;
  readonly problems: readonly string[];
};

type SpecEvidence = {
  /** `<layer>\n<id>` → the merged obligation; null when nothing is fresh. */
  readonly fresh: ReadonlyMap<string, Obligation> | null;
  readonly stale: number;
};

const key = (layer: Layer, id: string): string => `${layer}\n${id}`;

function merge(into: Map<string, Obligation>, obligation: Obligation): void {
  const k = key(obligation.layer, obligation.id);
  const earlier = into.get(k);
  if (earlier === undefined || obligation.status === 'fail') {
    into.set(k, obligation);
  }
}

/** Every spec's evidence, fresh records merged. */
export function indexEvidence(
  specs: readonly ReportSpec[],
  records: readonly EvidenceRecord[]
): ReadonlyMap<string, SpecEvidence> {
  const out = new Map<string, SpecEvidence>();
  for (const spec of specs) {
    let fresh: Map<string, Obligation> | null = null;
    let stale = 0;
    for (const record of records) {
      if (record.specUri !== spec.path) continue;
      if (record.specSha256 !== spec.sha256) {
        stale++;
        continue;
      }
      fresh ??= new Map();
      for (const obligation of record.obligations) merge(fresh, obligation);
    }
    out.set(spec.path, { fresh, stale });
  }
  return out;
}

type Index = ReadonlyMap<string, SpecEvidence>;

function absent(path: string, evidence: SpecEvidence | undefined): string {
  return (evidence?.stale ?? 0) > 0
    ? `${path}: stale evidence — recorded from another text of the spec; run its suite again`
    : `${path}: missing evidence — no suite recorded a verdict for it`;
}

function failure(path: string, obligation: Obligation): string {
  const detail = obligation.detail?.split('\n')[0]?.trim() ?? '';
  return `${path}: ${obligation.id} failed${detail === '' ? '' : ` — ${detail}`}`;
}

function selects(rule: EvidenceRule, spec: ReportSpec): boolean {
  if (spec.kind !== rule.kind) return false;
  const runs =
    rule.runs === 'any' ? spec.harness || spec.live : spec[rule.runs];
  if (!runs) return false;
  if (rule.subset === 'accessibility') return spec.accessibility;
  if (rule.subset === 'journeys') return spec.context === 'journeys';
  if (rule.subset === 'acceptance') {
    return !spec.accessibility && spec.context !== 'journeys';
  }
  return true;
}

function specProblems(
  rule: EvidenceRule,
  spec: ReportSpec,
  index: Index
): readonly string[] {
  const evidence = index.get(spec.path);
  if (evidence?.fresh == null) return [absent(spec.path, evidence)];
  const fresh = evidence.fresh;
  const obligations = [...fresh.values()].filter(
    (o) => o.layer === rule.layer && (rule.obligation?.test(o.id) ?? true)
  );
  const out: string[] = [];
  if (obligations.length === 0) {
    const which =
      rule.obligation === undefined
        ? ''
        : ` matching ${String(rule.obligation)}`;
    out.push(`${spec.path}: not run — no ${rule.layer} obligation${which}`);
  }
  if (rule.everyScenario === true) {
    for (const name of spec.scenarios) {
      if (!fresh.has(key(rule.layer, `scenario:${name}`))) {
        out.push(
          `${spec.path}: not run — scenario "${name}" has no ${rule.layer} verdict`
        );
      }
    }
  }
  for (const obligation of obligations) {
    if (obligation.status === 'fail') out.push(failure(spec.path, obligation));
  }
  return out;
}

type Tally = Pick<LineResult, 'passed' | 'total' | 'problems'>;

function tally(results: readonly (readonly string[])[]): Tally {
  return {
    total: results.length,
    passed: results.filter((problems) => problems.length === 0).length,
    problems: results.flat(),
  };
}

function evidenceLine(
  input: ReportInput,
  index: Index,
  rule: EvidenceRule
): Tally {
  return tally(
    input.specs
      .filter((spec) => selects(rule, spec))
      .map((spec) => specProblems(rule, spec, index))
  );
}

function decisionObligations(
  index: Index,
  capability: ReportInput['capabilities'][number]
): readonly Obligation[] | null {
  const fresh = index.get(capability.specUri)?.fresh;
  return fresh == null ? null : [...fresh.values()];
}

function capabilityLine(input: ReportInput, index: Index): Tally {
  return tally(
    input.capabilities.map((capability) => {
      const obligations = decisionObligations(index, capability);
      if (obligations === null) {
        return [
          `capability "${capability.id}": ${absent(capability.specUri, index.get(capability.specUri))}`,
        ];
      }
      return ['complete', 'consistent'].flatMap((check) => {
        const id = `${check}:${capability.decision}`;
        const found = obligations.find((o) => o.id === id);
        if (found === undefined) {
          return [
            `capability "${capability.id}": ${capability.specUri} has no ${id} verdict`,
          ];
        }
        return found.status === 'pass'
          ? []
          : [
              `capability "${capability.id}": ${failure(capability.specUri, found)}`,
            ];
      });
    })
  );
}

function coverageLine(input: ReportInput, index: Index): Tally {
  return tally(
    input.capabilities.map((capability) => {
      const obligations = decisionObligations(index, capability);
      if (obligations === null) {
        return [
          `capability "${capability.id}": ${absent(capability.specUri, index.get(capability.specUri))}`,
        ];
      }
      const agreements = obligations.filter((o) =>
        o.id.startsWith(`agree:${capability.decision}:`)
      );
      const out = agreements
        .filter((o) => o.status === 'fail')
        .map(
          (o) =>
            `capability "${capability.id}": ${failure(capability.specUri, o)}`
        );
      if (!agreements.some((o) => SERVER_AGREEMENT.test(o.id))) {
        out.push(
          `capability "${capability.id}": no server enforcement of "${capability.decision}" was checked`
        );
      }
      return out;
    })
  );
}

function gatesLine(input: ReportInput): Tally {
  return tally(
    input.gateTasks.map((task) => {
      const verdict = input.gates.get(task);
      if (verdict === undefined)
        return [`${task}: not run — no verdict for these inputs`];
      return verdict.status === 'pass' ? [] : [`${task}: ${verdict.detail}`];
    })
  );
}

function checksLine(input: ReportInput, index: Index): Tally {
  const run = input.specs.filter((spec) => spec.harness || spec.live);
  const result = tally(
    run.map((spec) => {
      const evidence = index.get(spec.path);
      if (evidence?.fresh == null) return [absent(spec.path, evidence)];
      return [...evidence.fresh.values()]
        .filter((o) => o.status === 'fail')
        .map((o) => failure(spec.path, o));
    })
  );
  // A malformed file is evidence nobody can read: the line fails on it.
  return {
    ...result,
    problems: [
      ...input.malformed.map((file) => `${file}: malformed evidence`),
      ...result.problems,
    ],
  };
}

function ruleTally(rule: Rule, input: ReportInput, index: Index): Tally {
  if (rule.type === 'evidence') return evidenceLine(input, index, rule);
  if (rule.type === 'closure') {
    return {
      total: 1,
      passed: input.closure.length === 0 ? 1 : 0,
      problems: input.closure,
    };
  }
  if (rule.type === 'gates') return gatesLine(input);
  if (rule.type === 'capabilities') return capabilityLine(input, index);
  if (rule.type === 'permission-coverage') return coverageLine(input, index);
  if (rule.type === 'adapters') {
    return tally(
      input.specs.map((spec) =>
        spec.bound
          ? []
          : [`${spec.path}: not bound exactly once — nothing checks it`]
      )
    );
  }
  return checksLine(input, index);
}

/** Every pipeline line, in order. A line with nothing to check fails. */
export function evaluateLines(input: ReportInput): readonly LineResult[] {
  const index = indexEvidence(input.specs, input.records);
  return (Object.keys(LINES) as LineId[]).map((id) => {
    const definition = LINES[id];
    const counted = ruleTally(definition.rule, input, index);
    const empty = counted.total === 0;
    const problems = empty
      ? ['missing automation — nothing feeds this line', ...counted.problems]
      : counted.problems;
    return {
      id,
      section: definition.section,
      label: definition.label,
      status: !empty && problems.length === 0 ? 'pass' : 'fail',
      passed: counted.passed,
      total: counted.total,
      problems,
    };
  });
}
