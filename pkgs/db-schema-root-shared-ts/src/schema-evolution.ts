import { indexKey } from './index-fingerprint';
import type { IndexDef, Snapshot } from './types';

/**
 * Evolution rules a schema change must satisfy to keep any older client
 * working. `fatal` blocks the change; `warning` is reported only.
 */
export type SchemaRule =
  | 'table-removed'
  | 'column-removed'
  | 'column-type-changed'
  | 'retired-column-type-changed'
  | 'retired-entry-removed'
  | 'physical-override-added'
  | 'unique-index-added';

export type SchemaViolation = {
  readonly path: string;
  readonly rule: SchemaRule;
  readonly message: string;
  readonly severity: 'fatal' | 'warning';
};

function retire(
  path: string,
  rule: SchemaRule,
  message: string,
  severity: SchemaViolation['severity']
): SchemaViolation {
  return { path, rule, message, severity };
}

function columnTypes(
  table: string,
  snapshot: Snapshot
): Record<string, string> {
  const cols = snapshot.tables[table];
  const out: Record<string, string> = {};
  for (const name of Object.keys(cols ?? {})) {
    out[name] = String(cols![name]);
  }
  return out;
}
/** Violations for a column that disappeared, given its tombstone (if any). */
function removedColumnViolations(
  path: string,
  prevType: string,
  tombstone: { readonly type: string } | undefined
): SchemaViolation[] {
  if (tombstone === undefined) {
    return [
      retire(
        path,
        'column-removed',
        `column '${path}' was removed — declare a retiredColumns tombstone with its frozen type`,
        'fatal'
      ),
    ];
  }
  if (tombstone.type !== prevType) {
    return [
      retire(
        path,
        'retired-column-type-changed',
        `column '${path}' was removed with frozen type '${tombstone.type}' but had type '${prevType}' — a tombstone must freeze the type the column actually had`,
        'fatal'
      ),
    ];
  }
  return [];
}

function diffTables(prev: Snapshot, next: Snapshot): SchemaViolation[] {
  const violations: SchemaViolation[] = [];
  const retiredTables = new Set(next.retiredTables.map((t) => t.name));
  for (const table of Object.keys(prev.tables)) {
    const prevCols = columnTypes(table, prev);
    const nextCols = columnTypes(table, next);
    if (!(table in next.tables)) {
      if (!retiredTables.has(table)) {
        violations.push(
          retire(
            table,
            'table-removed',
            `table '${table}' was removed — declare a retiredTables tombstone`,
            'fatal'
          )
        );
      }
      continue;
    }
    const retiredCols = next.retiredColumns[table] ?? {};
    for (const column of Object.keys(prevCols)) {
      const path = `${table}.${column}`;
      if (!(column in nextCols)) {
        violations.push(
          ...removedColumnViolations(
            path,
            String(prevCols[column]),
            retiredCols[column]
          )
        );
        continue;
      }
      if (prevCols[column] !== nextCols[column]) {
        violations.push(
          retire(
            path,
            'column-type-changed',
            `column '${path}' changed type '${prevCols[column]}' → '${nextCols[column]}'`,
            'fatal'
          )
        );
      }
    }
  }
  return violations;
}

function diffRetired(prev: Snapshot, next: Snapshot): SchemaViolation[] {
  const violations: SchemaViolation[] = [];
  for (const [table, columns] of Object.entries(prev.retiredColumns)) {
    for (const [column, entry] of Object.entries(columns)) {
      const path = `${table}.${column}`;
      const nextEntry = next.retiredColumns[table]?.[column];
      if (nextEntry === undefined) {
        violations.push(
          retire(
            path,
            'retired-entry-removed',
            `retiredColumns tombstone for '${path}' was removed — tombstones are permanent in the contract`,
            'fatal'
          )
        );
        continue;
      }
      if (nextEntry.type !== entry.type) {
        violations.push(
          retire(
            path,
            'retired-column-type-changed',
            `retired column '${path}' changed its frozen type '${entry.type}' → '${nextEntry.type}'`,
            'fatal'
          )
        );
      }
    }
  }
  const nextRetiredTables = new Set(next.retiredTables.map((t) => t.name));
  for (const entry of prev.retiredTables) {
    if (!nextRetiredTables.has(entry.name)) {
      violations.push(
        retire(
          entry.name,
          'retired-entry-removed',
          `retiredTables tombstone for '${entry.name}' was removed — tombstones are permanent in the contract`,
          'fatal'
        )
      );
    }
  }
  return violations;
}

function diffWarnings(prev: Snapshot, next: Snapshot): SchemaViolation[] {
  const violations: SchemaViolation[] = [];
  const prevUnique = new Set(
    prev.uniqueIndexes.map((def) => indexKey(def, true))
  );
  for (const def of next.uniqueIndexes as readonly IndexDef[]) {
    if (prevUnique.has(indexKey(def, true))) continue;
    violations.push(
      retire(
        (def as readonly string[]).join(','),
        'unique-index-added',
        `uniqueIndexes gained '${(def as readonly string[]).join(', ')}' — CREATE UNIQUE INDEX fails if existing rows already violate it`,
        'warning'
      )
    );
  }
  for (const [table, columns] of Object.entries(next.physicalOverrides)) {
    for (const column of Object.keys(columns)) {
      if (prev.physicalOverrides[table]?.[column] !== undefined) continue;
      const path = `${table}.${column}`;
      violations.push(
        retire(
          path,
          'physical-override-added',
          `column '${path}' gained a physical type override — it narrows the portability of the logical token`,
          'warning'
        )
      );
    }
  }
  return violations;
}

function compareViolations(a: SchemaViolation, b: SchemaViolation): number {
  if (a.path !== b.path) return a.path < b.path ? -1 : 1;
  return a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0;
}

/** Classify every change between two contract snapshots. */
export function diffSnapshots(
  prev: Snapshot,
  next: Snapshot
): readonly SchemaViolation[] {
  return [
    ...diffTables(prev, next),
    ...diffRetired(prev, next),
    ...diffWarnings(prev, next),
  ].sort(compareViolations);
}

/**
 * Throw when any fatal evolution rule is violated; return the warnings.
 * Fatal rules are the weeks-behind guarantee: a declared table or column may
 * not disappear without a tombstone, a logical type may not change, and a
 * tombstone may never be weakened or dropped.
 */
export function assertEvolvable(
  prev: Snapshot,
  next: Snapshot
): readonly SchemaViolation[] {
  const violations = diffSnapshots(prev, next);
  const fatal = violations.filter((v) => v.severity === 'fatal');
  if (fatal.length > 0) {
    throw new Error(
      `schema evolution refused:\n${fatal
        .map((v) => `${v.path}: ${v.rule}: ${v.message}`)
        .join('\n')}`
    );
  }
  return violations.filter((v) => v.severity === 'warning');
}
