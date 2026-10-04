/**
 * A snapshot of persisted state (a Postgres or SQLite database, projected by
 * a product adapter into atoms and relations) as an Alloy predicate that
 * pins every sig and every field of the model to exactly the snapshot. The
 * predicate is appended to the model's own text, so every fact and field
 * multiplicity applies: Alloy finds an instance iff the snapshot is a legal
 * world of the model. Alloy is the oracle; nothing here evaluates the logic.
 *
 * ```alloy
 * pred snapshot_0 {
 *   some disj atom_alice, atom_bob: Person, disj atom_s1: Space |
 *     Person = atom_alice + atom_bob
 *     and Space = atom_s1
 *     and host = atom_s1->atom_alice
 *     and members = atom_s1->atom_alice + atom_s1->atom_bob
 * }
 * run snapshot_0 for exactly 2 Person, exactly 1 Space
 * ```
 */

import { alloyAtomId } from './atom-id';
import type { FieldInfo } from './receipt';
import type { SigInfo } from './sigs';
import type { Snapshot } from './world';
import { isSubsetSig, resolveWorld } from './world';

/**
 * What in the model keeps any snapshot from being pinned: `var` sigs and
 * fields (a snapshot is one state, the model a trace) and Int-valued fields
 * (a count is not an atom; model it as a sig, or keep it out of the model).
 */
export function modelProblems(sigs: readonly SigInfo[]): readonly string[] {
  const problems: string[] = [];
  for (const sig of sigs) {
    if (sig.var) {
      problems.push(`var sig ${sig.name}: a snapshot is one state`);
    }
    for (const field of sig.fields) {
      const name = `${field.owner}.${field.name}`;
      if (field.var) {
        problems.push(`var field ${name}: a snapshot is one state`);
      }
      if (field.types.some((product) => product.includes('Int'))) {
        problems.push(
          `field ${name} holds Int values, which a snapshot cannot pin — model the value as a sig`
        );
      }
    }
  }
  return problems;
}

/** Everything that keeps the snapshot from being a world of the model at all. */
export function snapshotProblems(
  snapshot: Snapshot,
  sigs: readonly SigInfo[]
): readonly string[] {
  return resolveWorld(snapshot, sigs).problems;
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function union(expressions: readonly string[]): string | null {
  const terms = sortedUnique(expressions);
  return terms.length === 0 ? null : terms.join(' + ');
}

function pin(expression: string, value: string | null): string {
  return value === null ? `no ${expression}` : `${expression} = ${value}`;
}

function fieldExpression(field: FieldInfo, sigs: readonly SigInfo[]): string {
  const shared = sigs.some(
    (sig) =>
      sig.name !== field.owner && sig.fields.some((f) => f.name === field.name)
  );
  return shared ? `(${field.owner} <: ${field.name})` : field.name;
}

function quantifier(
  declaredIn: ReadonlyMap<string, string>,
  sigs: readonly SigInfo[]
): string | null {
  const groups = sigs
    .map((sig) => ({
      sig: sig.name,
      atoms: sortedUnique(
        [...declaredIn].filter(([, s]) => s === sig.name).map(([atom]) => atom)
      ),
    }))
    .filter((group) => group.atoms.length > 0)
    .map(
      (group) => `disj ${group.atoms.map(alloyAtomId).join(', ')}: ${group.sig}`
    );
  return groups.length === 0 ? null : `some ${groups.join(', ')} |`;
}

/**
 * The predicate `snapshot_<index>` pinning the model to the snapshot, and
 * the `run` that asks Alloy for it with every non-subset sig scoped to
 * exactly its atoms. Throws on {@link modelProblems} or
 * {@link snapshotProblems}.
 */
export function snapshotPredicate(
  snapshot: Snapshot,
  sigs: readonly SigInfo[],
  index: number,
  integerBits = 4
): string {
  const world = resolveWorld(snapshot, sigs);
  const problems = [...modelProblems(sigs), ...world.problems];
  if (problems.length > 0) {
    throw new Error(
      `snapshot ${snapshot.label} cannot be pinned:\n  ${problems.join('\n  ')}`
    );
  }
  const pins = [
    ...sigs.map((sig) =>
      pin(sig.name, union([...world.members(sig.name)].map(alloyAtomId)))
    ),
    ...[...world.relations].map(([field, tuples]) =>
      pin(
        fieldExpression(field, sigs),
        union(tuples.map((tuple) => tuple.map(alloyAtomId).join('->')))
      )
    ),
  ];
  const scopes = sigs
    .filter((sig) => !isSubsetSig(sig))
    .map(
      (sig) => `exactly ${String(world.members(sig.name).size)} ${sig.name}`
    );
  if (integerBits !== 4) scopes.push(`${String(integerBits)} Int`);
  const name = `snapshot_${String(index)}`;
  const opening = quantifier(world.declaredIn, sigs);
  const body =
    opening === null
      ? `  ${pins.join('\n  and ')}`
      : `  ${opening}\n    ${pins.join('\n    and ')}`;
  return [
    `pred ${name} {`,
    ...(pins.length === 0 ? [] : [body]),
    '}',
    scopes.length === 0
      ? `run ${name}`
      : `run ${name} for ${scopes.join(', ')}`,
    '',
  ].join('\n');
}

/** The snapshot as a report shows it: one line per sig and per relation. */
export function renderSnapshot(snapshot: Snapshot): string {
  const atoms = Object.entries(snapshot.atoms).map(
    ([sig, ids]) => `${sig} = ${ids.length === 0 ? 'none' : ids.join(', ')}`
  );
  const relations = Object.entries(snapshot.relations).map(
    ([field, tuples]) =>
      `${field} = ${tuples.length === 0 ? 'none' : tuples.map((t) => t.join('->')).join(' + ')}`
  );
  return [...atoms, ...relations].join('\n');
}
