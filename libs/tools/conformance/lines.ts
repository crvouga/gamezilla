/**
 * The lines of the conformance pipeline (strategy § 13): what each line
 * reads from the recorded evidence, and what feeds it (the proofs
 * `@libs/tools#ci:conformance` requires to exist). Evaluation lives in `evaluate.ts`.
 *
 * An evidence line selects specs (by kind, where they run, and a subset) and
 * the obligations of one layer. It passes only when every selected spec has
 * fresh evidence, at least one such obligation, every one of them `pass`, and
 * — for behavior — a verdict for every scenario in the spec's current text.
 */

import type { Layer, SpecKind } from '@pkgs/conformance-shared/evidence';
import type { Proof } from '@pkgs/conformance-shared/proofs';

/** Which specs of the kind an evidence line reads. */
export type SpecSubset =
  | 'all'
  | 'accessibility'
  | 'journeys'
  | 'acceptance'
  | 'permissions';

export type EvidenceRule = {
  readonly type: 'evidence';
  readonly kind: SpecKind;
  /** The obligations' layer. */
  readonly layer: Layer;
  /** Specs run against the harness, a deployment, or either. */
  readonly runs: 'harness' | 'live' | 'any';
  readonly subset: SpecSubset;
  /** Only obligations whose id matches; every selected spec needs one. */
  readonly obligation?: RegExp;
  /** Behavior: every scenario of the current text has a verdict. */
  readonly everyScenario?: boolean;
};

export type Rule =
  | EvidenceRule
  | {
      readonly type:
        | 'closure'
        | 'gates'
        | 'capabilities'
        | 'permission-coverage'
        | 'adapters'
        | 'conformance-verifications';
    };

export type LineDefinition = {
  /** The pipeline section the line is printed under. */
  readonly section: Layer;
  readonly label: string;
  /** What must exist for the line to be automated. */
  readonly feeds: readonly Proof[];
  readonly rule: Rule;
};

/** A decision layer that enforces at the server (`agree:<decision>:<layer>`). */
export const SERVER_AGREEMENT = /^agree:[^:]+:.*server/i;

function evidence(
  rule: Omit<EvidenceRule, 'type' | 'subset'> & { readonly subset?: SpecSubset }
): EvidenceRule {
  return { type: 'evidence', subset: 'all', ...rule };
}

export const LINES = {
  manifest: {
    section: 'specification',
    label: 'vocabulary / manifest',
    feeds: [{ task: '@libs/tools#ci:conformance' }],
    rule: { type: 'closure' },
  },
  'decision-analysis': {
    section: 'specification',
    label: 'DMN completeness & consistency',
    feeds: [{ kind: 'decisions' }],
    rule: evidence({
      kind: 'decisions',
      layer: 'specification',
      runs: 'harness',
    }),
  },
  'model-verifying': {
    section: 'specification',
    label: 'Quint model verifying',
    feeds: [{ kind: 'dynamics' }],
    rule: evidence({
      kind: 'dynamics',
      layer: 'specification',
      runs: 'harness',
    }),
  },
  'structure-verifying': {
    section: 'specification',
    label: 'Alloy model verifying',
    feeds: [{ kind: 'structure' }],
    rule: evidence({
      kind: 'structure',
      layer: 'specification',
      runs: 'harness',
    }),
  },
  'objective-validity': {
    section: 'specification',
    label: 'OpenSLO objectives well-formed',
    feeds: [{ kind: 'objectives' }],
    rule: evidence({ kind: 'objectives', layer: 'specification', runs: 'any' }),
  },
  'decision-conformance': {
    section: 'implementation',
    label: 'generated decision conformance',
    feeds: [{ kind: 'decisions' }],
    rule: evidence({
      kind: 'decisions',
      layer: 'implementation',
      runs: 'harness',
    }),
  },
  'permission-enforcement': {
    section: 'implementation',
    label: 'permission enforcement',
    feeds: [{ kind: 'decisions' }],
    rule: evidence({
      kind: 'decisions',
      layer: 'implementation',
      runs: 'harness',
      subset: 'permissions',
      obligation: SERVER_AGREEMENT,
    }),
  },
  'trace-conformance': {
    section: 'implementation',
    label: 'model-based / trace conformance',
    feeds: [{ kind: 'dynamics' }],
    rule: evidence({
      kind: 'dynamics',
      layer: 'implementation',
      runs: 'harness',
    }),
  },
  'structural-conformance': {
    section: 'implementation',
    label: 'Postgres / SQLite structural conformance',
    feeds: [{ kind: 'structure' }],
    rule: evidence({
      kind: 'structure',
      layer: 'implementation',
      runs: 'harness',
    }),
  },
  accessibility: {
    section: 'implementation',
    label: 'accessibility conformance',
    feeds: [{ kind: 'accessibility' }],
    rule: evidence({
      kind: 'behavior',
      layer: 'system',
      runs: 'harness',
      subset: 'accessibility',
      everyScenario: true,
    }),
  },
  acceptance: {
    section: 'system',
    label: 'Gherkin acceptance',
    feeds: [{ kind: 'behavior' }],
    rule: evidence({
      kind: 'behavior',
      layer: 'system',
      runs: 'harness',
      subset: 'acceptance',
      everyScenario: true,
    }),
  },
  journeys: {
    section: 'system',
    label: 'cross-context journeys',
    feeds: [{ spec: 'specs/journeys/critical-journeys.feature' }],
    rule: evidence({
      kind: 'behavior',
      layer: 'system',
      runs: 'harness',
      subset: 'journeys',
      everyScenario: true,
    }),
  },
  'harness-objectives': {
    section: 'system',
    label: 'quality objectives on the assembled system',
    feeds: [{ kind: 'objectives' }],
    rule: evidence({
      kind: 'objectives',
      layer: 'implementation',
      runs: 'harness',
    }),
  },
  synthetics: {
    section: 'release',
    label: 'production-safe synthetics',
    feeds: [
      { live: 'specs/journeys/critical-journeys.feature' },
      { live: 'specs/runtime/serving-people.feature' },
    ],
    rule: evidence({
      kind: 'behavior',
      layer: 'release',
      runs: 'live',
      everyScenario: true,
    }),
  },
  'live-objectives': {
    section: 'release',
    label: 'OpenSLO readiness policy',
    feeds: [
      { live: 'specs/runtime/availability.openslo.yaml' },
      { live: 'specs/runtime/request-speed.openslo.yaml' },
      { live: 'specs/runtime/request-success.openslo.yaml' },
    ],
    rule: evidence({ kind: 'objectives', layer: 'release', runs: 'live' }),
  },
  'release-gates': {
    section: 'release',
    label: 'release engineering gates',
    // Filled from the release gates' verifications by the evidence map.
    feeds: [],
    rule: { type: 'gates' },
  },
  capabilities: {
    section: 'completeness',
    label: 'declared capabilities',
    feeds: [{ kind: 'decisions' }],
    rule: { type: 'capabilities' },
  },
  'permission-coverage': {
    section: 'completeness',
    label: 'permission coverage',
    feeds: [{ kind: 'decisions' }],
    rule: { type: 'permission-coverage' },
  },
  adapters: {
    section: 'completeness',
    label: 'required adapters',
    feeds: [{ task: '@libs/tools#ci:specs' }],
    rule: { type: 'adapters' },
  },
  'conformance-verifications': {
    section: 'completeness',
    label: 'required conformance verifications',
    feeds: [{ task: '@libs/tools#ci:conformance' }],
    rule: { type: 'conformance-verifications' },
  },
} as const satisfies Readonly<Record<string, LineDefinition>>;

export type LineId = keyof typeof LINES;
