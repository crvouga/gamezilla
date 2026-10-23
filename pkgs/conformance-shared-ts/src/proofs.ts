/**
 * What proves a manifest entry — binding-side knowledge, declared by the
 * repository beside its bindings and never in the specs — and whether each
 * proof really is automated: the spec it names exists and is bound, the
 * check it names gates the release, the report line it names is fed.
 */

import type { ConformanceKind } from './manifest';

/** The kinds of spec file, by what they own (accessibility is a set of behavior specs). */
export type SpecFileKind = Exclude<ConformanceKind, 'accessibility'>;

export type Proof =
  /** A spec file a package runs against its harness. */
  | { readonly spec: string }
  /** A spec file a package runs against a deployed environment. */
  | { readonly live: string }
  /** A check the release gate runs (a task id). */
  | { readonly task: string }
  /** Every spec of a kind: at least one, each bound. */
  | { readonly kind: ConformanceKind }
  /** A line of the conformance report (a key of `EvidenceMap.lines`). */
  | { readonly line: string };

export type ProofTable = Readonly<Record<string, readonly Proof[]>>;

export type EvidenceMap = {
  readonly environments: ProofTable;
  readonly 'public contracts': ProofTable;
  readonly 'release gates': ProofTable;
  readonly 'production readiness': ProofTable;
  /** What feeds each line of the conformance report. */
  readonly lines: ProofTable;
  /** The behavior specs that are the accessibility kind. */
  readonly accessibility: readonly string[];
};

/** The manifest sections an evidence map must cover id for id. */
export const MAPPED_SECTIONS = [
  'environments',
  'public contracts',
  'release gates',
  'production readiness',
] as const;
export type MappedSection = (typeof MAPPED_SECTIONS)[number];

export type SpecFile = {
  /** `specs/<context>/<name>`. */
  readonly path: string;
  readonly context: string;
  readonly kind: SpecFileKind;
  /** It has exactly the binding its kind needs, so a runner checks it. */
  readonly bound: boolean;
  /** Some package runs it against its harness in the release gate. */
  readonly harness: boolean;
  /** Some package runs it against a deployment in its live check. */
  readonly live: boolean;
};

export type ProofWorld = {
  readonly specs: ReadonlyMap<string, SpecFile>;
  /** Every task id the release gate reaches. */
  readonly gatingTasks: ReadonlySet<string>;
  readonly evidence: EvidenceMap;
};

export function describeProof(proof: Proof): string {
  if ('spec' in proof) return proof.spec;
  if ('live' in proof) return `${proof.live} (live)`;
  if ('task' in proof) return `task ${proof.task}`;
  if ('kind' in proof) return `every ${proof.kind} spec`;
  return `report line "${proof.line}"`;
}

function specProblem(
  world: ProofWorld,
  path: string,
  live: boolean
): string | null {
  const spec = world.specs.get(path);
  if (spec === undefined) return `names ${path}, which does not exist`;
  if (!spec.bound)
    return `names ${path}, which is not bound exactly once — nothing checks it`;
  if (live && !spec.live) {
    return `names ${path} as live evidence, but no package runs it against a deployment`;
  }
  if (!live && !spec.harness) {
    return `names ${path}, but no package runs it against its harness in the release gate`;
  }
  return null;
}

/** The specs of a kind (accessibility: the evidence map's list). */
export function specsOfKind(
  world: Pick<ProofWorld, 'specs' | 'evidence'>,
  kind: ConformanceKind
): readonly string[] {
  if (kind === 'accessibility') return world.evidence.accessibility;
  return [...world.specs.values()]
    .filter((spec) => spec.kind === kind)
    .map((spec) => spec.path);
}

function kindProblem(world: ProofWorld, kind: ConformanceKind): string | null {
  // An unbound spec of the kind is reported once, against the spec itself.
  return specsOfKind(world, kind).length === 0
    ? `needs every ${kind} spec, and there is none`
    : null;
}

/** What is wrong with one proof, or null when it is automated. */
export function proofProblem(world: ProofWorld, proof: Proof): string | null {
  if ('spec' in proof) return specProblem(world, proof.spec, false);
  if ('live' in proof) return specProblem(world, proof.live, true);
  if ('task' in proof) {
    return world.gatingTasks.has(proof.task)
      ? null
      : `names task ${proof.task}, which the release gate does not run`;
  }
  if ('kind' in proof) return kindProblem(world, proof.kind);
  return Object.hasOwn(world.evidence.lines, proof.line)
    ? null
    : `names report line "${proof.line}", which the report does not have`;
}

/** Every problem with a table's proofs, `<label> "<id>": …`. */
export function tableProblems(
  world: ProofWorld,
  label: string,
  table: ProofTable
): readonly string[] {
  const out: string[] = [];
  for (const [id, proofs] of Object.entries(table)) {
    if (proofs.length === 0) {
      out.push(
        `${label} "${id}": nothing proves it — map it to the checks that do`
      );
    }
    for (const proof of proofs) {
      const problem = proofProblem(world, proof);
      if (problem !== null) out.push(`${label} "${id}": ${problem}`);
    }
  }
  return out;
}

/** Report lines are fed by specs, tasks and kinds, never by other lines. */
export function lineProblems(world: ProofWorld): readonly string[] {
  const out: string[] = [
    ...tableProblems(world, 'report line', world.evidence.lines),
  ];
  for (const [id, proofs] of Object.entries(world.evidence.lines)) {
    if (proofs.some((proof) => 'line' in proof)) {
      out.push(
        `report line "${id}": is fed by another line — name what feeds it`
      );
    }
  }
  return out;
}
