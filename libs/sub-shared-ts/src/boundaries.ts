/**
 * The table boundary between subs, checked rather than agreed.
 *
 * A sub owns a set of tables. Its queries may read those, plus exactly the
 * foreign tables it declared in `readsForeign` — a declaration the fold also
 * checks is real (some sub in the composition owns it) and used (the
 * queries actually touch it), so the list cannot rot into a wishlist.
 *
 * Table names come from the SQL AST, not from anything a sub author wrote
 * down twice, so the check cannot be satisfied by editing a list. A nested
 * sub is part of the walk, so its tables count as owned.
 */

import { extractQueryTables } from '@pkgs/sync-engine-shared-ts/extract-workload';
import { queryRegistry } from '@pkgs/sync-engine-shared-ts/queries-registry';

import { flattenSubs } from './flatten';
import type { SubManifest } from './manifest';

export type TableBoundaryViolation = {
  readonly sub: string;
  readonly kind: 'undeclared-read' | 'unknown-foreign' | 'unused-foreign';
  readonly table: string;
  /** Query that touched the table (absent for declaration-only problems). */
  readonly query?: string;
};

function describe(violation: TableBoundaryViolation): string {
  const where =
    violation.query === undefined ? '' : ` (query '${violation.query}')`;
  switch (violation.kind) {
    case 'undeclared-read':
      return `${violation.sub}: reads '${violation.table}'${where}, which it neither owns nor declares in readsForeign`;
    case 'unknown-foreign':
      return `${violation.sub}: declares readsForeign '${violation.table}', which no sub in this composition owns`;
    case 'unused-foreign':
      return `${violation.sub}: declares readsForeign '${violation.table}' but no query reads it — drop it`;
  }
}

function ownersOf(subs: readonly SubManifest[]): ReadonlyMap<string, string> {
  const owners = new Map<string, string>();
  for (const sub of subs) {
    for (const table of sub.tables) owners.set(table.name, sub.name);
  }
  return owners;
}

async function violationsForSub(args: {
  readonly sub: SubManifest;
  readonly owners: ReadonlyMap<string, string>;
}): Promise<TableBoundaryViolation[]> {
  const { sub, owners } = args;
  const out: TableBoundaryViolation[] = [];
  const own = new Set(sub.tables.map((t) => t.name));
  const declared = new Set(sub.readsForeign ?? []);
  for (const table of declared) {
    if (!owners.has(table)) {
      out.push({ sub: sub.name, kind: 'unknown-foreign', table });
    }
  }
  if (sub.queries.length === 0) return out;
  const byQuery = await extractQueryTables(queryRegistry([...sub.queries]));
  const touchedForeign = new Set<string>();
  for (const [query, tables] of byQuery) {
    for (const table of tables) {
      if (own.has(table) || !owners.has(table)) continue;
      touchedForeign.add(table);
      if (declared.has(table)) continue;
      out.push({
        sub: sub.name,
        kind: 'undeclared-read',
        table,
        query,
      });
    }
  }
  for (const table of declared) {
    if (owners.has(table) && !touchedForeign.has(table)) {
      out.push({ sub: sub.name, kind: 'unused-foreign', table });
    }
  }
  return out;
}

/** Every way the composed subs cross each other's tables illegitimately. */
export async function findTableBoundaryViolations(
  roots: readonly SubManifest[]
): Promise<readonly TableBoundaryViolation[]> {
  const subs = flattenSubs(roots, 'findTableBoundaryViolations');
  const owners = ownersOf(subs);
  const found = await Promise.all(
    subs.map((sub) => violationsForSub({ sub, owners }))
  );
  return found.flat();
}

/** CI gate: throws listing every violation, or returns silently. */
export async function assertTableBoundaries(
  roots: readonly SubManifest[]
): Promise<void> {
  const violations = await findTableBoundaryViolations(roots);
  if (violations.length === 0) return;
  throw new Error(
    [
      'sub table boundaries violated:',
      ...violations.map((v) => `  ${describe(v)}`),
    ].join('\n')
  );
}
