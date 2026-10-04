/**
 * The closed-world checks (strategy §§ 11, 18, 19, 22, 23): the manifest and
 * the repository describe the same product, and every entry of the manifest
 * has an automated check. Pure over plain facts — the repository's gate
 * reads the files, this decides — so every rule is property-testable.
 *
 * - Every `specs/<context>/` is a manifest context, and every context has one.
 * - Every capability is answered by the decision it names: a decision with a
 *   capability input lists it among its values, a decision without one is
 *   named by exactly one capability, and every capability value any decision
 *   lists is a manifest capability decided by that decision (§ 19).
 * - Every required kind of spec has a spec, and every spec is bound (§ 11).
 * - Every objective measures a service that is a manifest context (§ 19).
 * - The evidence map covers exactly the manifest's environments, public
 *   contracts, release gates and readiness requirements, and each of their
 *   proofs is automated (§ 23.8, 23.9); a public contract is proven by at
 *   least one spec of its own context.
 */

import type { ConformanceManifest } from './manifest';
import type { EvidenceMap, ProofWorld, SpecFile } from './proofs';
import {
  lineProblems,
  MAPPED_SECTIONS,
  specsOfKind,
  tableProblems,
} from './proofs';

export type DecisionFacts = {
  /** The spec file the decision is in. */
  readonly specUri: string;
  readonly id: string;
  /** The values of its capability input; null when it has none. */
  readonly capabilities: readonly string[] | null;
};

export type ObjectiveFacts = {
  readonly specUri: string;
  readonly slo: string;
  readonly service: string;
};

export type ClosureWorld = {
  readonly manifest: ConformanceManifest;
  /** The context directories present under `specs/`. */
  readonly specDirectories: readonly string[];
  readonly specs: readonly SpecFile[];
  readonly decisions: readonly DecisionFacts[];
  readonly objectives: readonly ObjectiveFacts[];
  readonly evidence: EvidenceMap;
  /** Every task id the release gate reaches. */
  readonly gatingTasks: ReadonlySet<string>;
};

export function contextProblems(
  contexts: readonly string[],
  directories: readonly string[]
): readonly string[] {
  const out: string[] = [];
  for (const directory of directories) {
    if (!contexts.includes(directory)) {
      out.push(
        `specs/${directory}/: not a context in the manifest's product.contexts — declare it`
      );
    }
  }
  for (const context of contexts) {
    if (!directories.includes(context)) {
      out.push(`product.contexts "${context}": there is no specs/${context}/`);
    }
  }
  return out;
}

function capabilityDecisionProblems(
  manifest: ConformanceManifest,
  decisions: readonly DecisionFacts[]
): readonly string[] {
  const out: string[] = [];
  for (const capability of manifest.product.capabilities) {
    const by = capability['decided by'];
    const named = decisions.filter((decision) => decision.id === by);
    const decision = named[0];
    if (decision === undefined) {
      out.push(
        `capability "${capability.id}": no decision table has the decision "${by}"`
      );
    } else if (named.length > 1) {
      out.push(
        `capability "${capability.id}": the decision "${by}" is in several tables (${named.map((d) => d.specUri).join(', ')})`
      );
    } else if (
      decision.capabilities !== null &&
      !decision.capabilities.includes(capability.id)
    ) {
      out.push(
        `capability "${capability.id}": ${decision.specUri} decision "${by}" does not list it among what they want to do`
      );
    }
  }
  return out;
}

function decisionCapabilityProblems(
  manifest: ConformanceManifest,
  decisions: readonly DecisionFacts[]
): readonly string[] {
  const out: string[] = [];
  const byId = new Map(manifest.product.capabilities.map((c) => [c.id, c]));
  for (const decision of decisions) {
    const where = `${decision.specUri} decision "${decision.id}"`;
    const naming = manifest.product.capabilities.filter(
      (c) => c['decided by'] === decision.id
    );
    if (decision.capabilities === null) {
      if (naming.length !== 1) {
        out.push(
          `${where}: answers one capability, so exactly one manifest capability must be decided by it (found ${String(naming.length)})`
        );
      }
      continue;
    }
    for (const value of decision.capabilities) {
      const capability = byId.get(value);
      if (capability === undefined) {
        out.push(
          `${where}: "${value}" is not a capability in the manifest — declare it`
        );
      } else if (capability['decided by'] !== decision.id) {
        out.push(
          `${where}: answers "${value}", which the manifest says is decided by "${capability['decided by']}"`
        );
      }
    }
    if (naming.length === 0) {
      out.push(`${where}: no manifest capability is decided by it`);
    }
  }
  return out;
}

/** § 19: capabilities and decision tables name each other exactly. */
export function capabilityProblems(
  manifest: ConformanceManifest,
  decisions: readonly DecisionFacts[]
): readonly string[] {
  return [
    ...capabilityDecisionProblems(manifest, decisions),
    ...decisionCapabilityProblems(manifest, decisions),
  ];
}

/** § 11: every required kind has a spec; every spec is bound. */
export function specKindProblems(
  world: Pick<ClosureWorld, 'manifest' | 'specs' | 'evidence'>
): readonly string[] {
  const specs = new Map(world.specs.map((spec) => [spec.path, spec]));
  const out: string[] = [];
  for (const kind of Object.keys(world.manifest.conformance)) {
    const paths = specsOfKind(
      { specs, evidence: world.evidence },
      kind as keyof ConformanceManifest['conformance']
    );
    if (paths.length === 0) {
      out.push(`conformance "${kind}": required, but there is no ${kind} spec`);
    }
    for (const path of paths) {
      if (!specs.has(path)) {
        out.push(`conformance "${kind}": ${path} does not exist`);
      }
    }
  }
  for (const spec of world.specs) {
    if (!spec.bound) {
      out.push(
        `${spec.path}: not bound exactly once (bun run spec:check says why) — nothing checks it, so it cannot count`
      );
    }
  }
  return out;
}

export function objectiveProblems(
  contexts: readonly string[],
  objectives: readonly ObjectiveFacts[]
): readonly string[] {
  return objectives
    .filter((objective) => !contexts.includes(objective.service))
    .map(
      (objective) =>
        `${objective.specUri} SLO "${objective.slo}": service "${objective.service}" is not a context in the manifest`
    );
}

function manifestIds(
  manifest: ConformanceManifest,
  section: (typeof MAPPED_SECTIONS)[number]
): readonly string[] {
  if (section === 'environments') return manifest.environments.map((e) => e.id);
  if (section === 'public contracts') {
    return manifest.product['public contracts'].map((c) => c.id);
  }
  if (section === 'release gates') return manifest['release gates'];
  return manifest['production readiness'].require;
}

/** § 23.8/23.9: the evidence map and the manifest name the same ids. */
export function mappingProblems(
  manifest: ConformanceManifest,
  evidence: EvidenceMap
): readonly string[] {
  const out: string[] = [];
  for (const section of MAPPED_SECTIONS) {
    const ids = manifestIds(manifest, section);
    const mapped = Object.keys(evidence[section]);
    for (const id of ids) {
      if (!mapped.includes(id)) {
        out.push(
          `${section} "${id}": nothing maps it to the checks that prove it`
        );
      }
    }
    for (const id of mapped) {
      if (!ids.includes(id)) {
        out.push(
          `${section} "${id}": mapped, but not in the manifest — remove it or declare it`
        );
      }
    }
  }
  return out;
}

function contractContextProblems(world: ClosureWorld): readonly string[] {
  const out: string[] = [];
  const specs = new Map(world.specs.map((spec) => [spec.path, spec]));
  for (const contract of world.manifest.product['public contracts']) {
    const proofs = world.evidence['public contracts'][contract.id] ?? [];
    const own = proofs.some((proof) => {
      const path =
        'spec' in proof ? proof.spec : 'live' in proof ? proof.live : null;
      return path !== null && specs.get(path)?.context === contract.context;
    });
    if (proofs.length > 0 && !own) {
      out.push(
        `public contracts "${contract.id}": no spec of its context ${contract.context} proves it`
      );
    }
  }
  return out;
}

function proofProblems(world: ClosureWorld): readonly string[] {
  const proofWorld: ProofWorld = {
    specs: new Map(world.specs.map((spec) => [spec.path, spec])),
    gatingTasks: world.gatingTasks,
    evidence: world.evidence,
  };
  return [
    ...MAPPED_SECTIONS.flatMap((section) =>
      tableProblems(proofWorld, section, world.evidence[section])
    ),
    ...lineProblems(proofWorld),
  ];
}

/** Every way the world is not closed; empty when it is. */
export function closureProblems(world: ClosureWorld): readonly string[] {
  const { manifest } = world;
  return [
    ...contextProblems(manifest.product.contexts, world.specDirectories),
    ...capabilityProblems(manifest, world.decisions),
    ...specKindProblems(world),
    ...objectiveProblems(manifest.product.contexts, world.objectives),
    ...mappingProblems(manifest, world.evidence),
    ...proofProblems(world),
    ...contractContextProblems(world),
  ];
}
