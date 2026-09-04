import { defineSystem, virtualHost } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import { reconcileIndexes } from '../../core/reconcile';
import type { WorkloadManifest } from '../../core/types';
import { checkIndexesInvariants, manifestForCol } from './invariants';
import { startReconciler } from './nodes';
import type { IndexesSurface } from './types';
import { reconcilerOf } from './types';

function emptyManifest(): WorkloadManifest {
  return { version: 1, queries: [] };
}

const CFG = {
  minTableRows: 1,
  createEstimatedMs: 10,
  dropEstimatedMs: 10,
  metaEstimatedMs: 1,
  deprecationWindowDays: 1,
  maxBuildsPerRun: 3,
  maxIndexesPerTable: 6,
} as const;

/** One in-memory reconciler behind a virtual clock; no topology args. */
export const indexes = defineSystem<IndexesSurface>({
  name: 'db-indexes.reconcile',
  create(session) {
    return {
      session,
      reconciler: startReconciler(),
    } satisfies IndexesSurface;
  },
});

indexes.host({ default: true, name: 'virtual', create: () => virtualHost() });

export function ownedIndexCount(s: IndexesSurface): number {
  return reconcilerOf(s).db.getOwnedIndexNames().length;
}

export function lastCrash(s: IndexesSurface): boolean {
  return reconcilerOf(s).lastCrash;
}

export async function invariantViolations(
  s: IndexesSurface
): Promise<string[]> {
  try {
    await checkIndexesInvariants(reconcilerOf(s));
    return [];
  } catch (e) {
    return [e instanceof Error ? e.message : String(e)];
  }
}

async function runReconcile(s: IndexesSurface): Promise<void> {
  const state = reconcilerOf(s);
  try {
    const report = await reconcileIndexes({
      manifest: state.manifest,
      db: state.db,
      clock: state.clock,
      deadlineMs: 60_000,
      config: CFG,
    });
    state.lastReport = report;
    state.lastCrash = report.failed.some((f) =>
      (f.reason ?? '').includes('crash')
    );
    if (
      report.failed.some((f) => f.reason?.includes('crash')) ||
      report.notes.some((n) => n.includes('crash'))
    ) {
      const fork = state.db.fork(state.clock);
      await reconcileIndexes({
        manifest: state.manifest,
        db: fork,
        clock: state.clock,
        deadlineMs: 60_000,
        config: CFG,
      });
      state.lastCrash = true;
    }
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === 'SimCrashError' || err.message.includes('sim'))
    ) {
      state.lastCrash = true;
      const fork = state.db.fork(state.clock);
      await reconcileIndexes({
        manifest: state.manifest,
        db: fork,
        clock: state.clock,
        deadlineMs: 60_000,
        config: CFG,
      });
    } else {
      throw err;
    }
  }
}

export const reconcile = indexes.action({
  name: 'reconcile',
  act: async (s) => {
    await runReconcile(s);
  },
});

export const advanceClock = indexes.action<[number]>({
  name: 'advanceClock',
  draw: () => gen(fc.constantFrom(1, 2, 40)),
  act: (s, days) => {
    reconcilerOf(s).clock.advance(days * 24 * 60 * 60 * 1000);
  },
});

export type ManifestMode = 'user' | 'owner' | 'empty';

export const setManifest = indexes.action<[string]>({
  name: 'setManifest',
  weight: 3,
  draw: () => gen(fc.constantFrom('user', 'owner', 'empty')),
  act: (s, mode) => {
    const state = reconcilerOf(s);
    if (mode === 'empty') {
      state.manifest = emptyManifest();
      return;
    }
    const col = mode === 'user' ? 'user_id' : 'owner_id';
    state.manifest = manifestForCol('notes', col);
  },
});

export const bumpUsage = indexes.action({
  name: 'bumpUsage',
  enabled: (s) => ownedIndexCount(s) > 0,
  act: (s) => {
    const state = reconcilerOf(s);
    const names = state.db.getOwnedIndexNames();
    if (names.length > 0) {
      state.db.bumpScans(names[0]!, 1);
    }
  },
});

export const externalAdd = indexes.action({
  name: 'externalAdd',
  act: (s) => {
    reconcilerOf(s).db.externalAddIndex({
      name: 'ix_notes_title',
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

export const invariantsHold = indexes.property({
  name: 'invariants',
  check: async (s) => {
    const v = await invariantViolations(s);
    if (v.length > 0) throw new Error(v[0]!);
  },
});
