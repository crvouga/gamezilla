/**
 * The table boundary between features, checked rather than agreed.
 *
 * A feature owns a set of tables. Its queries may read those, plus exactly the
 * foreign tables it declared in `readsForeign` — a declaration the fold also
 * checks is real (some feature in the composition owns it) and used (the
 * queries actually touch it), so the list cannot rot into a wishlist.
 *
 * Table names come from the SQL AST, not from anything a feature author wrote
 * down twice, so the check cannot be satisfied by editing a list.
 */

import { extractQueryTables, queryRegistry } from '@pkgs/sync-engine/shared';

import type { FeatureManifest } from './manifest';

export type TableBoundaryViolation = {
  readonly feature: string;
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
      return `${violation.feature}: reads '${violation.table}'${where}, which it neither owns nor declares in readsForeign`;
    case 'unknown-foreign':
      return `${violation.feature}: declares readsForeign '${violation.table}', which no feature in this composition owns`;
    case 'unused-foreign':
      return `${violation.feature}: declares readsForeign '${violation.table}' but no query reads it — drop it`;
  }
}

function ownersOf(
  features: readonly FeatureManifest[]
): ReadonlyMap<string, string> {
  const owners = new Map<string, string>();
  for (const feature of features) {
    for (const table of feature.tables) owners.set(table.name, feature.name);
  }
  return owners;
}

async function violationsForFeature(args: {
  readonly feature: FeatureManifest;
  readonly owners: ReadonlyMap<string, string>;
}): Promise<TableBoundaryViolation[]> {
  const { feature, owners } = args;
  const out: TableBoundaryViolation[] = [];
  const own = new Set(feature.tables.map((t) => t.name));
  const declared = new Set(feature.readsForeign ?? []);
  for (const table of declared) {
    if (!owners.has(table)) {
      out.push({ feature: feature.name, kind: 'unknown-foreign', table });
    }
  }
  if (feature.queries.length === 0) return out;
  const byQuery = await extractQueryTables(queryRegistry([...feature.queries]));
  const touchedForeign = new Set<string>();
  for (const [query, tables] of byQuery) {
    for (const table of tables) {
      if (own.has(table) || !owners.has(table)) continue;
      touchedForeign.add(table);
      if (declared.has(table)) continue;
      out.push({
        feature: feature.name,
        kind: 'undeclared-read',
        table,
        query,
      });
    }
  }
  for (const table of declared) {
    if (owners.has(table) && !touchedForeign.has(table)) {
      out.push({ feature: feature.name, kind: 'unused-foreign', table });
    }
  }
  return out;
}

/** Every way the composed features cross each other's tables illegitimately. */
export async function findTableBoundaryViolations(
  features: readonly FeatureManifest[]
): Promise<readonly TableBoundaryViolation[]> {
  const owners = ownersOf(features);
  const found = await Promise.all(
    features.map((feature) => violationsForFeature({ feature, owners }))
  );
  return found.flat();
}

/** CI gate: throws listing every violation, or returns silently. */
export async function assertTableBoundaries(
  features: readonly FeatureManifest[]
): Promise<void> {
  const violations = await findTableBoundaryViolations(features);
  if (violations.length === 0) return;
  throw new Error(
    [
      'feature table boundaries violated:',
      ...violations.map((v) => `  ${describe(v)}`),
    ].join('\n')
  );
}
