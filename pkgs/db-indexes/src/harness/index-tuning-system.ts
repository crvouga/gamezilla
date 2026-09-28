/**
 * Index tuning as the team sees it (`specs/index-tuning/`): one reconciler
 * over an in-memory {@link HarnessDb} on a virtual clock. The team declares
 * lookups (a workload manifest), tuning runs (`reconcileIndexes`), days pass,
 * lookups use tuned indexes, and the team keeps an index of its own. The
 * standing {@link tuningInvariantsHold} property checks the reconciler's
 * safety invariants after every action.
 */

import {
  defineAction,
  defineProperty,
  defineRuntime,
  defineSystem,
  type Session,
  virtualTimeRuntime,
} from '@pkgs/harness';
import type { Config } from '../core/config';
import { fingerprintSql } from '../core/fingerprint';
import { isOwnedName } from '../core/naming';
import { reconcileIndexes } from '../core/reconcile';
import type { ReconcileReport, WorkloadManifest } from '../core/types';
import { createHarnessClock } from './clock';
import { HarnessDb } from './db';
import { checkInvariantsAsync } from './invariants';

/** A lookup the team can declare, by the notes field it finds them by. */
export type Lookup = 'notesByAuthor' | 'notesByOwner';

export const LOOKUPS: readonly Lookup[] = ['notesByAuthor', 'notesByOwner'];

const LOOKUP_FIELD: Readonly<Record<Lookup, string>> = {
  notesByAuthor: 'user_id',
  notesByOwner: 'owner_id',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PER_TABLE = 6;
const TEAM_INDEX_NAME = 'ix_notes_title';

/** Tuning settings: a one-day retirement window, every table worth tuning. */
export const TUNING_CONFIG: Partial<Config> = {
  minTableRows: 1,
  createEstimatedMs: 10,
  dropEstimatedMs: 10,
  metaEstimatedMs: 1,
  deprecationWindowDays: 1,
  maxBuildsPerRun: 3,
  maxIndexesPerTable: MAX_PER_TABLE,
};

export type Tuner = {
  readonly db: HarnessDb;
  readonly clock: ReturnType<typeof createHarnessClock>;
  manifest: WorkloadManifest;
  lastReport: ReconcileReport | null;
};

export type IndexTuning = {
  readonly session: Session;
  readonly tuner: Tuner;
};

function lookupManifest(lookups: readonly Lookup[]): WorkloadManifest {
  return {
    version: 1,
    queries: lookups.map((lookup) => {
      const sql = `SELECT id FROM notes WHERE ${LOOKUP_FIELD[lookup]} = ?`;
      return {
        name: lookup,
        hydrates: ['notes'],
        statements: [
          { index: 0, sql, fingerprint: fingerprintSql(sql), weight: 1 },
        ],
      };
    }),
  };
}

function lookupOfField(field: string | undefined): Lookup {
  const lookup = LOOKUPS.find((l) => LOOKUP_FIELD[l] === field);
  if (lookup === undefined) {
    throw new Error(`tuned index on ${String(field)} serves no lookup`);
  }
  return lookup;
}

/** The tuned index each lookup has, by its name. */
async function tunedIndexByLookup(
  s: IndexTuning
): Promise<Map<Lookup, string>> {
  const indexes = await s.tuner.db.introspectIndexes();
  const out = new Map<Lookup, string>();
  for (const ix of indexes) {
    if (!(ix.isOwned || isOwnedName(ix.name))) continue;
    out.set(lookupOfField(ix.columns[0]), ix.name);
  }
  return out;
}

/** The lookups that have a tuned index. */
export async function tunedLookups(s: IndexTuning): Promise<Lookup[]> {
  return [...(await tunedIndexByLookup(s)).keys()].sort();
}

/** The lookups whose tuned index is retiring. */
export async function retiringLookups(s: IndexTuning): Promise<Lookup[]> {
  const byLookup = await tunedIndexByLookup(s);
  const metas = await s.tuner.db.readOwnedMeta();
  const retiring = new Set(
    metas.filter((m) => m.deprecatedAt != null).map((m) => m.name as string)
  );
  return [...byLookup]
    .filter(([, name]) => retiring.has(name))
    .map(([lookup]) => lookup)
    .sort();
}

/** How many times each tuned index has been used, by its lookup. */
export async function usesByLookup(
  s: IndexTuning
): Promise<Map<Lookup, number>> {
  const byLookup = await tunedIndexByLookup(s);
  const usage = await s.tuner.db.readIndexUsage();
  const out = new Map<Lookup, number>();
  for (const [lookup, name] of byLookup) {
    out.set(lookup, usage.find((u) => u.name === name)?.scans ?? 0);
  }
  return out;
}

/** Whether the team's own index is there. */
export async function teamIndexKept(s: IndexTuning): Promise<boolean> {
  const indexes = await s.tuner.db.introspectIndexes();
  return indexes.some((ix) => ix.name === TEAM_INDEX_NAME);
}

/** How many changes the last tuning run made (0 before any run). */
export function lastTuningChanges(s: IndexTuning): number {
  return s.tuner.lastReport?.plan.actions.length ?? 0;
}

/** Every tuned index's name, in order — the tuning outcome replay compares. */
export function tunedIndexNames(s: IndexTuning): string[] {
  return s.tuner.db.getOwnedIndexNames().sort();
}

/** The team declares exactly these lookups. */
export const declare = defineAction({
  name: 'declare',
  act: (s: IndexTuning, lookups: readonly Lookup[]) => {
    s.tuner.manifest = lookupManifest(lookups);
  },
});

/** One tuning run over the declared lookups. */
export const tune = defineAction({
  name: 'tune',
  act: async (s: IndexTuning) => {
    s.tuner.lastReport = await reconcileIndexes({
      manifest: s.tuner.manifest,
      db: s.tuner.db,
      clock: s.tuner.clock,
      deadlineMs: 60_000,
      config: TUNING_CONFIG,
    });
  },
});

export const daysPass = defineAction({
  name: 'daysPass',
  act: (s: IndexTuning, days: number) => {
    s.tuner.clock.advance(days * DAY_MS);
  },
});

/** The lookup finds its answer through its tuned index once. */
export const use = defineAction({
  name: 'use',
  act: async (s: IndexTuning, lookup: Lookup) => {
    const name = (await tunedIndexByLookup(s)).get(lookup);
    if (name === undefined) throw new Error(`${lookup} has no tuned index`);
    s.tuner.db.bumpScans(name, 1);
  },
});

/** The team adds an index of its own. */
export const keepOwnIndex = defineAction({
  name: 'keepOwnIndex',
  act: (s: IndexTuning) => {
    s.tuner.db.externalAddIndex({
      name: TEAM_INDEX_NAME,
      table: 'notes',
      columns: ['title'],
      include: [],
      predicate: null,
      isUnique: false,
      isPrimary: false,
      isValid: true,
      isOwned: false,
    });
  },
});

/**
 * The reconciler's safety invariants: only owned names in the owned set and
 * in what the last run executed, no unique owned index, the per-table
 * budget, and no retiring index dropped after it was used.
 */
export const tuningInvariantsHold = defineProperty({
  name: 'tuning-invariants',
  check: async (s: IndexTuning) => {
    const report = s.tuner.lastReport;
    const lastCompleted =
      report?.completed.map((a) => ({
        kind: a.kind,
        name: a.name as string,
      })) ?? [];
    const violations = await checkInvariantsAsync(s.tuner.db, MAX_PER_TABLE, {
      lastCompleted,
    });
    for (const a of lastCompleted) {
      if (!isOwnedName(a.name)) {
        violations.push({ id: 'I1_executed', detail: `executed ${a.name}` });
      }
    }
    if (violations.length > 0) {
      throw new Error(`${violations[0]!.id}: ${violations[0]!.detail}`);
    }
  },
});

/** One reconciler over two 50 000-row tables, nothing declared yet. */
export const indexTuningSystem = defineSystem<IndexTuning>({
  name: 'db-indexes.index-tuning',
  create(session) {
    const clock = createHarnessClock(0);
    const db = new HarnessDb({
      clock,
      tables: [
        { name: 'notes', estimatedRows: 50_000 },
        { name: 'users', estimatedRows: 50_000 },
      ],
      defaultImprovement: 10,
    });
    return {
      session,
      tuner: { db, clock, manifest: lookupManifest([]), lastReport: null },
    };
  },
  runtimes: [
    defineRuntime({
      default: true,
      name: 'virtual',
      create: () => virtualTimeRuntime(),
    }),
  ],
  actions: [declare, tune, daysPass, use, keepOwnIndex],
  properties: [tuningInvariantsHold],
});
