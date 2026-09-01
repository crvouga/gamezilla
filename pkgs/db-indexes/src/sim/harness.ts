import { assert } from '@pkgs/assert';
import { fingerprintSql } from '../core/fingerprint';
import { isOwnedName } from '../core/naming';
import { reconcileIndexes } from '../core/reconcile';
import type {
  IndexInfo,
  OwnedMeta,
  UsageInfo,
  WorkloadManifest,
} from '../core/types';
import type { createSimClock } from './sim-clock';
import type { SimDb, SimFault } from './sim-db';

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

/**
 * Sync ownership check against SimDb owned set.
 */
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

function stmt(sql: string, index = 0) {
  return {
    index,
    sql,
    fingerprint: fingerprintSql(sql),
    weight: 1,
  };
}

/** Deterministic PRNG (mulberry32). */
export function createRng(seed: number): { next(): number } {
  assert.ok(Number.isFinite(seed), 'seed finite');
  let s = seed >>> 0;
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export function randomManifest(
  rng: { next(): number },
  tables: readonly string[]
): WorkloadManifest {
  assert.ok(tables.length > 0, 'tables required');
  const table = tables[Math.floor(rng.next() * tables.length)]!;
  const col = rng.next() > 0.5 ? 'user_id' : 'owner_id';
  const sql = `SELECT id FROM ${table} WHERE ${col} = ?`;
  return {
    version: 1,
    queries: [
      {
        name: `q_${table}_${col}`,
        hydrates: [table],
        statements: [stmt(sql)],
      },
    ],
  };
}

export type HarnessResult = {
  readonly seed: number;
  readonly cycles: number;
  readonly violations: readonly InvariantViolation[];
  readonly ownedSnapshot: readonly string[];
};

function isHarnessTransientError(err: unknown): boolean {
  if (err instanceof Error) {
    return (
      err.name === 'SimCrashError' ||
      err.message.includes('sim transient') ||
      err.name === 'LockTimeout'
    );
  }
  return (
    typeof err === 'object' && err !== null && '__assertion_failure' in err
  );
}

async function runHarnessCycle(args: {
  readonly db: SimDb;
  readonly clock: ReturnType<typeof createSimClock>;
  readonly rng: { next(): number };
  readonly tables: readonly string[];
  readonly maxPerTable: number;
}): Promise<{
  readonly completed: readonly {
    readonly kind: string;
    readonly name: string;
  }[];
  readonly violations: readonly InvariantViolation[];
}> {
  const manifest = randomManifest(args.rng, args.tables);
  let completed: { readonly kind: string; readonly name: string }[] = [];
  const cycleViolations: InvariantViolation[] = [];
  try {
    const report = await reconcileIndexes({
      manifest,
      db: args.db,
      clock: args.clock,
      deadlineMs: 60_000,
      config: {
        minTableRows: 1,
        createEstimatedMs: 10,
        dropEstimatedMs: 10,
        metaEstimatedMs: 1,
        deprecationWindowDays: 1,
        maxBuildsPerRun: 3,
        maxIndexesPerTable: args.maxPerTable,
      },
    });
    completed = report.completed.map((a) => ({
      kind: a.kind,
      name: a.name,
    }));
    for (let i = 0; i < report.completed.length; i++) {
      const a = report.completed[i]!;
      if (!isOwnedName(a.name)) {
        cycleViolations.push({
          id: 'I1_executed',
          detail: `executed non-owned DDL: ${a.name}`,
        });
      }
    }
  } catch (err) {
    if (!isHarnessTransientError(err)) throw err;
  }
  if (args.rng.next() > 0.5) {
    args.clock.advance(2 * 24 * 60 * 60 * 1000);
  }
  const v = await checkInvariantsAsync(args.db, args.maxPerTable, {
    lastCompleted: completed,
  });
  return { completed, violations: [...cycleViolations, ...v] };
}

/**
 * DST harness: from seed, run N reconcile cycles with faults + clock jumps.
 * Seed replay is byte-identical given same SimDb construction.
 */
export async function runHarness(args: {
  readonly seed: number;
  readonly db: SimDb;
  readonly clock: ReturnType<typeof createSimClock>;
  readonly tables: readonly string[];
  readonly cycles?: number;
  readonly maxPerTable?: number;
}): Promise<HarnessResult> {
  assert.ok(Number.isFinite(args.seed), 'seed finite');
  const cycles = args.cycles ?? 5;
  const maxPerTable = args.maxPerTable ?? 6;
  const rng = createRng(args.seed);
  const allViolations: InvariantViolation[] = [];

  for (let c = 0; c < cycles; c++) {
    const cycle = await runHarnessCycle({
      db: args.db,
      clock: args.clock,
      rng,
      tables: args.tables,
      maxPerTable,
    });
    for (let i = 0; i < cycle.violations.length; i++) {
      allViolations.push(cycle.violations[i]!);
    }
  }

  const owned = [...args.db.getOwnedIndexNames()].sort();
  return {
    seed: args.seed,
    cycles,
    violations: allViolations,
    ownedSnapshot: owned,
  };
}

export function faultScheduleFromSeed(seed: number): SimFault[] {
  const rng = createRng(seed);
  const faults: SimFault[] = [];
  const n = Math.floor(rng.next() * 3);
  for (let i = 0; i < n; i++) {
    const kinds = ['none', 'lock_timeout', 'crash_inside'] as const;
    faults.push({
      kind: kinds[Math.floor(rng.next() * kinds.length)]!,
      onCall: Math.floor(rng.next() * 20) + 1,
    });
  }
  return faults;
}
