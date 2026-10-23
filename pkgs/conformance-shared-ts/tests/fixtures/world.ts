/**
 * Closed worlds for the closure checks: a manifest and a repository that
 * describe the same product, every entry proven. `closedWorld` builds one
 * from a few choices, so a property can draw them.
 */

import type {
  ClosureWorld,
  DecisionFacts,
} from '@pkgs/conformance-shared-ts/closure';
import type { Capability } from '@pkgs/conformance-shared-ts/manifest';
import {
  CONFORMANCE_KINDS,
  FAIL_STATES,
  REQUIREMENTS,
} from '@pkgs/conformance-shared-ts/manifest';
import type {
  ProofTable,
  SpecFile,
  SpecFileKind,
} from '@pkgs/conformance-shared-ts/proofs';

export type WorldShape = {
  /** Distinct context names; the first holds every non-behavior spec. */
  readonly contexts: readonly string[];
  /** Per decision: its capabilities, or null for a decision answering one. */
  readonly decisions: readonly (readonly string[] | null)[];
  readonly environments: readonly string[];
  readonly gates: readonly string[];
};

const SUFFIX: Readonly<Record<SpecFileKind, string>> = {
  behavior: 'feature',
  decisions: 'dmn',
  dynamics: 'qnt',
  structure: 'als',
  objectives: 'openslo.yaml',
};

function spec(context: string, name: string, kind: SpecFileKind): SpecFile {
  return {
    path: `specs/${context}/${name}.${SUFFIX[kind]}`,
    context,
    kind,
    bound: true,
    harness: true,
    live: kind === 'behavior' || kind === 'objectives',
  };
}

function decisionsOf(
  shape: WorldShape,
  home: string
): {
  readonly decisions: readonly DecisionFacts[];
  readonly capabilities: readonly Capability[];
} {
  const decisions: DecisionFacts[] = [];
  const capabilities: Capability[] = [];
  for (const [i, values] of shape.decisions.entries()) {
    const id = `decision-${String(i)}`;
    const specUri = `specs/${home}/${id}.dmn`;
    decisions.push({ specUri, id, capabilities: values });
    for (const capability of values ?? [`the one thing ${String(i)} answers`]) {
      capabilities.push({ id: capability, context: home, 'decided by': id });
    }
  }
  return { decisions, capabilities };
}

function specsOf(shape: WorldShape, home: string): SpecFile[] {
  return [
    ...shape.contexts.map((context) =>
      spec(context, `${context}-story`, 'behavior')
    ),
    ...shape.decisions.map((_, i) =>
      spec(home, `decision-${String(i)}`, 'decisions')
    ),
    spec(home, 'model', 'dynamics'),
    spec(home, 'structure', 'structure'),
    spec(home, 'objectives', 'objectives'),
  ];
}

export function closedWorld(shape: WorldShape): ClosureWorld {
  const home = shape.contexts[0] ?? 'home';
  const { decisions, capabilities } = decisionsOf(shape, home);
  const story = `specs/${home}/${home}-story.feature`;
  const proofs = (
    ids: readonly string[],
    table: (id: string) => ProofTable[string]
  ) => Object.fromEntries(ids.map((id) => [id, table(id)]));
  return {
    manifest: {
      product: {
        contexts: shape.contexts,
        tiers: ['guest'],
        capabilities,
        'public contracts': [
          { id: 'the link', context: home, promise: 'It works.' },
        ],
      },
      conformance: Object.fromEntries(
        CONFORMANCE_KINDS.map((k) => [k, 'required'])
      ) as never,
      environments: shape.environments.map((id) => ({ id, promise: 'There.' })),
      'production readiness': {
        'manual testing allowed': false,
        require: [...REQUIREMENTS],
        'fail on': [...FAIL_STATES],
      },
      'release gates': shape.gates,
    },
    specDirectories: shape.contexts,
    specs: specsOf(shape, home),
    decisions,
    objectives: [
      {
        specUri: `specs/${home}/objectives.openslo.yaml`,
        slo: 'fast',
        service: home,
      },
    ],
    evidence: {
      environments: proofs(shape.environments, () => [{ spec: story }]),
      'public contracts': { 'the link': [{ spec: story }, { live: story }] },
      'release gates': proofs(shape.gates, (id) => [{ task: `//#gate:${id}` }]),
      'production readiness': proofs(REQUIREMENTS, () => [
        { line: 'everything' },
      ]),
      lines: { everything: [{ kind: 'behavior' }, { kind: 'accessibility' }] },
      accessibility: [story],
    },
    gatingTasks: new Set(shape.gates.map((id) => `//#gate:${id}`)),
  };
}
