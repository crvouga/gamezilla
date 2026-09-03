import { assert } from '@pkgs/assert';
import { isOwnedName } from '../core/naming';
import type { IndexInfo, OwnedMeta, UsageInfo } from '../core/types';
import type { SimDb } from './sim-db';

export type InvariantViolation = {
  readonly id: string;
  readonly detail: string;
};

function usageScans(usage: readonly UsageInfo[], name: string): number {
  for (let i = 0; i < usage.length; i++) {
    if (usage[i]!.name === name) return usage[i]!.scans;
  }
  return 0;
}

/** Sync ownership check against SimDb owned set. */
export function checkInvariants(db: SimDb): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const indexes = db.getOwnedIndexNames();
  for (let i = 0; i < indexes.length; i++) {
    const name = indexes[i]!;
    if (!isOwnedName(name)) {
      violations.push({
        id: 'I1_owned_name',
        detail: `non-owned index in owned set: ${name}`,
      });
    }
    if (name.startsWith('ix_') || name.startsWith('ux_')) {
      violations.push({
        id: 'I1_schema_prefix',
        detail: `owned set must never include ix_/ux_: ${name}`,
      });
    }
  }
  return violations;
}

function assertOwnedIndexShape(
  indexes: readonly IndexInfo[],
  violations: InvariantViolation[]
): Map<string, number> {
  const byTable = new Map<string, number>();
  for (let i = 0; i < indexes.length; i++) {
    const ix = indexes[i]!;
    if (!(ix.isOwned || isOwnedName(ix.name))) continue;
    if (ix.isUnique || ix.isPrimary) {
      violations.push({
        id: 'I1_unique_owned',
        detail: `owned index must not be unique/primary: ${ix.name}`,
      });
    }
    byTable.set(ix.table, (byTable.get(ix.table) ?? 0) + 1);
  }
  return byTable;
}

function assertPerTableBudget(
  byTable: ReadonlyMap<string, number>,
  maxPerTable: number,
  violations: InvariantViolation[]
): void {
  for (const [table, count] of byTable) {
    if (count > maxPerTable) {
      violations.push({
        id: 'per_table_budget',
        detail: `table ${table} has ${String(count)} owned indexes > ${String(maxPerTable)}`,
      });
    }
  }
}

function assertCompletedDrops(
  lastCompleted: readonly { readonly kind: string; readonly name: string }[],
  metas: readonly OwnedMeta[],
  usage: readonly UsageInfo[],
  violations: InvariantViolation[]
): void {
  for (let i = 0; i < lastCompleted.length; i++) {
    const a = lastCompleted[i]!;
    if (a.kind !== 'drop') continue;
    const m = metas.find((x) => x.name === a.name);
    if (m?.deprecatedAt != null && m.usageAtDeprecation != null) {
      const scans = usageScans(usage, a.name);
      if (!isOwnedName(a.name)) {
        violations.push({
          id: 'I1_drop_owned',
          detail: `drop of non-owned: ${a.name}`,
        });
      }
      void scans;
      void m;
    }
  }
}

/** I3 companion: deprecated indexes with usage growth must still exist. */
function assertUsageHoldInvariant(
  indexes: readonly IndexInfo[],
  metas: readonly OwnedMeta[],
  usage: readonly UsageInfo[],
  violations: InvariantViolation[]
): void {
  const present = new Set(indexes.map((i) => i.name));
  for (let i = 0; i < metas.length; i++) {
    const m = metas[i]!;
    if (m.deprecatedAt == null || m.usageAtDeprecation == null) continue;
    const scans = usageScans(usage, m.name);
    if (scans > m.usageAtDeprecation && !present.has(m.name)) {
      violations.push({
        id: 'I3_usage_hold',
        detail: `index ${m.name} dropped despite usage growth ${String(m.usageAtDeprecation)}→${String(scans)}`,
      });
    }
  }
}

/**
 * Full invariant suite: ownership, per-table budget, usage-guarded drops,
 * and optional fixpoint (empty plan after a fault-free re-plan).
 */
export async function checkInvariantsAsync(
  db: SimDb,
  maxPerTable: number,
  opts?: {
    readonly lastCompleted?: readonly {
      readonly kind: string;
      readonly name: string;
    }[];
    readonly expectFixpointEmpty?: boolean;
    readonly planActionCount?: number;
  }
): Promise<InvariantViolation[]> {
  assert.ok(maxPerTable > 0, 'maxPerTable > 0');
  const violations = checkInvariants(db);
  const indexes = await db.introspectIndexes();
  const metas = await db.readOwnedMeta();
  const usage = await db.readIndexUsage();

  const byTable = assertOwnedIndexShape(indexes, violations);
  assertPerTableBudget(byTable, maxPerTable, violations);

  if (opts?.lastCompleted !== undefined) {
    assertCompletedDrops(opts.lastCompleted, metas, usage, violations);
  }

  assertUsageHoldInvariant(indexes, metas, usage, violations);

  if (
    opts?.expectFixpointEmpty === true &&
    opts.planActionCount !== undefined &&
    opts.planActionCount > 0
  ) {
    violations.push({
      id: 'fixpoint',
      detail: `expected empty plan after fault-free settle, got ${String(opts.planActionCount)} actions`,
    });
  }

  return violations;
}
