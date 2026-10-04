/**
 * A snapshot read against a model's sigs: where each atom is declared, which
 * atoms each sig holds (a sig holds its own atoms and every subsig's), and
 * which field each relation names — plus everything that keeps the snapshot
 * from being a world at all (an unknown sig, a tuple of the wrong arity, an
 * atom no sig declares). Whether that world is *legal* is Alloy's call.
 */

import { alloyAtomId } from './atom-id';
import type { FieldInfo } from './receipt';
import type { SigInfo } from './sigs';

export type Snapshot = {
  /** Names the snapshot in reports (`server database after seed 7`). */
  readonly label: string;
  /** Sig name → the atoms declared in it (most specific sig; subset sigs list their members). */
  readonly atoms: Readonly<Record<string, readonly string[]>>;
  /**
   * Field (`host`, or `Space.host` when two sigs declare `host`) → tuples,
   * each starting with the owning atom, as Alloy fields do.
   */
  readonly relations: Readonly<Record<string, readonly (readonly string[])[]>>;
};

export type ResolvedWorld = {
  readonly problems: readonly string[];
  /** Atom → the primary (non-subset) sig it is declared in. */
  readonly declaredIn: ReadonlyMap<string, string>;
  /** The atoms a sig holds: its own, its subsigs', or a subset sig's listed ones. */
  readonly members: (sig: string) => ReadonlySet<string>;
  /** Every field of the model with the tuples the snapshot gives it (maybe none). */
  readonly relations: ReadonlyMap<FieldInfo, readonly (readonly string[])[]>;
};

export function isSubsetSig(sig: SigInfo): boolean {
  return sig.subsetOf.length > 0;
}

function declareAtoms(snapshot: Snapshot, sigs: readonly SigInfo[]) {
  const byName = new Map(sigs.map((s) => [s.name, s]));
  const problems: string[] = [];
  const declaredIn = new Map<string, string>();
  for (const [sigName, atoms] of Object.entries(snapshot.atoms)) {
    const sig = byName.get(sigName);
    if (sig === undefined) {
      problems.push(`unknown sig ${sigName}`);
      continue;
    }
    if (isSubsetSig(sig)) continue;
    const hasSubsigs = sigs.some((s) => s.parent === sig.name);
    if (sig.abstract && hasSubsigs && atoms.length > 0) {
      problems.push(
        `abstract sig ${sig.name} holds no atoms of its own — declare ${atoms.join(', ')} in one of its subsigs`
      );
    }
    for (const atom of atoms) {
      const earlier = declaredIn.get(atom);
      if (earlier !== undefined) {
        problems.push(
          `atom ${atom} is declared twice (in ${earlier} and ${sig.name})`
        );
      } else declaredIn.set(atom, sig.name);
    }
  }
  return { byName, problems, declaredIn };
}

function membership(
  snapshot: Snapshot,
  sigs: readonly SigInfo[],
  declaredIn: ReadonlyMap<string, string>
): (sig: string) => ReadonlySet<string> {
  const byName = new Map(sigs.map((s) => [s.name, s]));
  const within = (sig: string, ancestor: string): boolean => {
    for (let at: string | null = sig; at !== null; ) {
      if (at === ancestor) return true;
      at = byName.get(at)?.parent ?? null;
    }
    return false;
  };
  const cache = new Map<string, ReadonlySet<string>>();
  return (name) => {
    const cached = cache.get(name);
    if (cached !== undefined) return cached;
    const sig = byName.get(name);
    const atoms =
      name === 'univ'
        ? new Set(declaredIn.keys())
        : sig === undefined
          ? new Set<string>()
          : isSubsetSig(sig)
            ? new Set(snapshot.atoms[name] ?? [])
            : new Set(
                [...declaredIn]
                  .filter(([, declared]) => within(declared, name))
                  .map(([atom]) => atom)
              );
    cache.set(name, atoms);
    return atoms;
  };
}

function multiplicityProblem(sig: SigInfo, count: number): string | null {
  const ok =
    sig.multiplicity === 'one'
      ? count === 1
      : sig.multiplicity === 'lone'
        ? count <= 1
        : sig.multiplicity === 'some'
          ? count >= 1
          : true;
  return ok
    ? null
    : `${sig.multiplicity} sig ${sig.name} has ${String(count)} atoms`;
}

function sigProblems(
  snapshot: Snapshot,
  sigs: readonly SigInfo[],
  members: (sig: string) => ReadonlySet<string>
): string[] {
  const problems: string[] = [];
  for (const sig of sigs) {
    if (sig.var) continue;
    const problem = multiplicityProblem(sig, members(sig.name).size);
    if (problem !== null) problems.push(problem);
    if (!isSubsetSig(sig)) continue;
    for (const atom of snapshot.atoms[sig.name] ?? []) {
      if (!sig.subsetOf.some((parent) => members(parent).has(atom))) {
        problems.push(
          `atom ${atom} of subset sig ${sig.name} is not in ${sig.subsetOf.join(' + ')}`
        );
      }
    }
  }
  return problems;
}

function resolveField(
  key: string,
  sigs: readonly SigInfo[]
): FieldInfo | string {
  const dot = key.lastIndexOf('.');
  const owner = dot < 0 ? null : key.slice(0, dot);
  const name = dot < 0 ? key : key.slice(dot + 1);
  const candidates = sigs
    .filter((sig) => owner === null || sig.name === owner)
    .flatMap((sig) => sig.fields.filter((field) => field.name === name));
  const [field] = candidates;
  if (field === undefined) return `unknown field ${key}`;
  if (candidates.length > 1) {
    const owners = candidates.map((c) => `${c.owner}.${name}`).join(', ');
    return `field ${key} is ambiguous — name it ${owners}`;
  }
  return field;
}

function tupleProblem(
  field: FieldInfo,
  tuple: readonly string[],
  world: Pick<ResolvedWorld, 'declaredIn' | 'members'>
): string | null {
  const shown = `${field.owner}.${field.name} tuple ${tuple.join('->')}`;
  if (tuple.length !== field.arity) {
    return `${shown} has ${String(tuple.length)} atoms, the field has arity ${String(field.arity)}`;
  }
  const unknown = tuple.filter((atom) => !world.declaredIn.has(atom));
  if (unknown.length > 0) {
    return `${shown} names ${unknown.join(', ')}, which no sig declares`;
  }
  const typed = field.types.some((product) =>
    product.every((column, i) => world.members(column).has(tuple[i] ?? ''))
  );
  const expected = field.types.map((p) => p.join('->')).join(' + ');
  return typed ? null : `${shown} is not of type ${expected}`;
}

function resolveRelations(
  snapshot: Snapshot,
  sigs: readonly SigInfo[],
  world: Pick<ResolvedWorld, 'declaredIn' | 'members'>
) {
  const problems: string[] = [];
  const relations = new Map<FieldInfo, (readonly string[])[]>();
  const given = new Set<FieldInfo>();
  for (const sig of sigs) {
    for (const field of sig.fields) relations.set(field, []);
  }
  for (const [key, tuples] of Object.entries(snapshot.relations)) {
    const field = resolveField(key, sigs);
    if (typeof field === 'string') {
      problems.push(field);
      continue;
    }
    if (given.has(field)) {
      problems.push(`field ${field.owner}.${field.name} is given twice`);
      continue;
    }
    given.add(field);
    const kept: (readonly string[])[] = [];
    for (const tuple of tuples) {
      const problem = tupleProblem(field, tuple, world);
      if (problem === null) kept.push(tuple);
      else problems.push(problem);
    }
    relations.set(field, kept);
  }
  return { problems, relations };
}

function collisionProblems(
  declaredIn: ReadonlyMap<string, string>,
  sigs: readonly SigInfo[]
): string[] {
  const names = new Set(
    sigs.flatMap((sig) => [sig.name, ...sig.fields.map((f) => f.name)])
  );
  return [...declaredIn.keys()]
    .filter((atom) => names.has(alloyAtomId(atom)))
    .map(
      (atom) =>
        `atom ${atom} is written ${alloyAtomId(atom)}, a name the model already uses`
    );
}

export function resolveWorld(
  snapshot: Snapshot,
  sigs: readonly SigInfo[]
): ResolvedWorld {
  const declared = declareAtoms(snapshot, sigs);
  const members = membership(snapshot, sigs, declared.declaredIn);
  const world = { declaredIn: declared.declaredIn, members };
  const relations = resolveRelations(snapshot, sigs, world);
  return {
    ...world,
    relations: relations.relations,
    problems: [
      ...declared.problems,
      ...sigProblems(snapshot, sigs, members),
      ...relations.problems,
      ...collisionProblems(declared.declaredIn, sigs),
    ],
  };
}
