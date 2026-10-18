/**
 * The verdict of the conformance pipeline from recorded evidence — pure, so
 * the report script only gathers files and the rules here are unit-tested.
 *
 * Evidence is fresh when it was produced from the spec's current text
 * (`specSha256`); a spec whose only evidence is from another text is stale,
 * and a spec with none is missing — both fail. Fresh records of one spec from
 * several report buckets are merged; when two disagree on one obligation the
 * failure wins, since nothing records which ran last.
 *
 * A spec its host runs once per variant (a shared game specification, once
 * per game) is held to a verdict of its own for every variant the host
 * declared it needs (`variant-evidence.ts`): one variant's verdict never
 * decides another's, and a variant verdict without a declaration decides
 * nothing.
 */

import type {
  EvidenceRecord,
  Layer,
  Obligation,
  SpecKind,
} from '@pkgs/conformance-shared/evidence';
import type { SpecVariants } from '@pkgs/conformance-shared/variants';

import type { EvidenceRule, LineId, Rule } from './lines';
import { LINES, SERVER_AGREEMENT } from './lines';
import type { VariantCell, VariantEvidence } from './variant-evidence';
import {
  key,
  variantCells,
  variantLayer,
  variantProblems,
} from './variant-evidence';

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
  /** Dynamics: every public temporal property in the current model text. */
  readonly temporalProperties: readonly string[];
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
  /** Spec path → the variants its host declared it needs, for a varied spec. */
  readonly variants: ReadonlyMap<string, SpecVariants>;
  /** What `@libs/tools#ci:conformance` finds wrong (empty: the world is closed). */
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

type SpecEvidence = VariantEvidence & {
  /** `<layer>\n<id>` → the merged obligation; null when nothing is fresh. */
  readonly fresh: ReadonlyMap<string, Obligation> | null;
  readonly stale: number;
};

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
    const staleIds = new Set<string>();
    for (const record of records) {
      if (record.specUri !== spec.path) continue;
      if (record.specSha256 !== spec.sha256) {
        stale++;
        for (const o of record.obligations) staleIds.add(key(o.layer, o.id));
        continue;
      }
      fresh ??= new Map();
      for (const obligation of record.obligations) merge(fresh, obligation);
    }
    out.set(spec.path, { fresh, stale, staleIds });
  }
  return out;
}

type Index = ReadonlyMap<string, SpecEvidence>;

/**
 * Why scenario `name` of an unvaried spec is undecided, or null when it has
 * its verdict. Verdicts per variant decide it only through the variants its
 * host declared (`variant-evidence.ts`), never on their own.
 */
function undecided(
  path: string,
  fresh: ReadonlyMap<string, Obligation>,
  layer: Layer,
  name: string
): string | null {
  if (fresh.has(key(layer, `scenario:${name}`))) return null;
  const variant = key(layer, `scenario:${name} [`);
  return [...fresh.keys()].some((id) => id.startsWith(variant))
    ? `${path}: not run — scenario "${name}" ran per variant, but its host declared no variant it needs`
    : `${path}: not run — scenario "${name}" has no ${layer} verdict`;
}

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
    spec.kind === 'dynamics' && rule.layer === 'specification'
      ? spec.bound
      : rule.runs === 'any'
        ? spec.harness || spec.live
        : spec[rule.runs];
  if (!runs) return false;
  if (rule.subset === 'accessibility') return spec.accessibility;
  if (rule.subset === 'journeys') return spec.context === 'journeys';
  if (rule.subset === 'acceptance') {
    return !spec.accessibility && spec.context !== 'journeys';
  }
  return true;
}

/** The spec's per-variant problems for `rule`, or null when it runs once. */
function variedProblems(
  rule: EvidenceRule,
  spec: ReportSpec,
  index: Index,
  requirement: SpecVariants | undefined
): readonly string[] | null {
  if (requirement === undefined || variantLayer(spec.kind) !== rule.layer)
    return null;
  if (spec.kind === 'behavior' && rule.everyScenario !== true) return null;
  return variantProblems({
    path: spec.path,
    layer: rule.layer,
    scenarios: spec.kind === 'behavior' ? spec.scenarios : null,
    evidence: index.get(spec.path),
    requirement,
  });
}

/**
 * What the spec's evidence leaves undecided: a varied spec's cells, or every
 * scenario of an unvaried feature.
 */
/** An obligation recorded for one variant (`trace:3 [chess]`). */
const VARIANT_TAG = / \[[^\]]+\]$/;

function coverageProblems(
  rule: EvidenceRule,
  spec: ReportSpec,
  index: Index,
  variants: ReportInput['variants']
): readonly string[] {
  const varied = variedProblems(rule, spec, index, variants.get(spec.path));
  if (varied !== null) return varied;
  const fresh = index.get(spec.path)?.fresh;
  if (fresh == null) return [];
  if (spec.kind === 'dynamics' && variantLayer(spec.kind) === rule.layer)
    return [...fresh.values()].some(
      (o) => o.layer === rule.layer && VARIANT_TAG.test(o.id)
    )
      ? [
          `${spec.path}: not run — it ran per variant, but its host declared no variant it needs`,
        ]
      : [];
  if (rule.everyScenario !== true) return [];
  return spec.scenarios.flatMap((name) => {
    const why = undecided(spec.path, fresh, rule.layer, name);
    return why === null ? [] : [why];
  });
}

function specProblems(
  rule: EvidenceRule,
  spec: ReportSpec,
  index: Index,
  variants: ReportInput['variants']
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
  out.push(...coverageProblems(rule, spec, index, variants));
  if (spec.kind === 'dynamics' && rule.layer === 'specification') {
    for (const property of spec.temporalProperties) {
      if (!fresh.has(key('specification', `temporal:${property}`))) {
        out.push(
          `${spec.path}: not run — temporal property "${property}" has no specification verdict`
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
      .filter(
        (spec) =>
          rule.subset !== 'permissions' ||
          input.capabilities.some(
            (capability) => capability.specUri === spec.path
          )
      )
      .map((spec) => specProblems(rule, spec, index, input.variants))
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
  const run = input.specs.filter(
    (spec) =>
      spec.harness || spec.live || (spec.kind === 'dynamics' && spec.bound)
  );
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

/** Every cell of every varied spec, for the report and its log. */
export function evaluateVariantCells(
  input: ReportInput
): readonly VariantCell[] {
  const index = indexEvidence(input.specs, input.records);
  return input.specs.flatMap((spec) => {
    const requirement = input.variants.get(spec.path);
    return requirement === undefined
      ? []
      : variantCells({
          path: spec.path,
          kind: spec.kind,
          scenarios: spec.scenarios,
          evidence: index.get(spec.path),
          requirement,
        });
  });
}
