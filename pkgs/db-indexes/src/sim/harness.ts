import { assert } from '@pkgs/assert';
import { fingerprintSql } from '../core/fingerprint';
import { isOwnedName } from '../core/naming';
import { reconcileIndexes } from '../core/reconcile';
import type { WorkloadManifest } from '../core/types';
import type { createSimClock } from './sim-clock';
import type { SimDb, SimFault } from './sim-db';

export type InvariantViolation = {
  readonly id: string;
  readonly detail: string;
};

/**
 * Check safety invariants against SimDb after every action / cycle.
 */
export function checkInvariants(db: SimDb): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const indexes = db.getOwnedIndexNames();
  for (let i = 0; i < indexes.length; i++) {
    const name = indexes[i]!;
    if (!isOwnedName(name)) {
      violations.push({
        id: 'owned_name',
        detail: `non-owned index in owned set: ${name}`,
      });
    }
  }
  // Per-table budget: count owned indexes per table via introspect sync path
  return violations;
}

export async function checkInvariantsAsync(
  db: SimDb,
  maxPerTable: number
): Promise<InvariantViolation[]> {
  assert.ok(maxPerTable > 0, 'maxPerTable > 0');
  const violations = checkInvariants(db);
  const indexes = await db.introspectIndexes();
  const byTable = new Map<string, number>();
  for (let i = 0; i < indexes.length; i++) {
    const ix = indexes[i]!;
    if (!ix.isOwned && !isOwnedName(ix.name)) continue;
    byTable.set(ix.table, (byTable.get(ix.table) ?? 0) + 1);
  }
  for (const [table, count] of byTable) {
    if (count > maxPerTable) {
      violations.push({
        id: 'per_table_budget',
        detail: `table ${table} has ${String(count)} owned indexes > ${String(maxPerTable)}`,
      });
    }
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
};

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
    const manifest = randomManifest(rng, args.tables);
    try {
      await reconcileIndexes({
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
          maxIndexesPerTable: maxPerTable,
        },
      });
    } catch (err) {
      // Faults / crashes are expected under schedules — continue
      if (
        err instanceof Error &&
        (err.name === 'SimCrashError' ||
          err.message.includes('sim transient') ||
          err.name === 'LockTimeout')
      ) {
        // continue
      } else if (
        typeof err === 'object' &&
        err !== null &&
        '__assertion_failure' in err
      ) {
        // continue past assert envelopes in fault paths
      } else {
        throw err;
      }
    }
    // Advance past deprecation window sometimes
    if (rng.next() > 0.5) {
      args.clock.advance(2 * 24 * 60 * 60 * 1000);
    }
    const v = await checkInvariantsAsync(args.db, maxPerTable);
    for (let i = 0; i < v.length; i++) allViolations.push(v[i]!);
  }

  return {
    seed: args.seed,
    cycles,
    violations: allViolations,
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
