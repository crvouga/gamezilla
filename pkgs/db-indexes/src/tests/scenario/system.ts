import { defineSystem, draw } from '@pkgs/dst';
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

export const indexes = defineSystem({
  name: 'db-indexes.reconcile',
  generate(session) {
    return {
      session,
      reconciler: startReconciler(),
    } satisfies IndexesSurface;
  },
});

const { defineObservation, defineAction, defineProperty } = indexes;

export const ownedIndexCount = defineObservation({
  name: 'ownedIndexCount',
  observe: (s) => reconcilerOf(s).db.getOwnedIndexNames().length,
});

export const lastCrash = defineObservation({
  name: 'lastCrash',
  observe: (s) => reconcilerOf(s).lastCrash,
});

export const invariantViolations = defineObservation({
  name: 'invariantViolations',
  observe: async (s) => {
    try {
      await checkIndexesInvariants(reconcilerOf(s));
      return [] as string[];
    } catch (e) {
      return [e instanceof Error ? e.message : String(e)];
    }
  },
});

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

export const reconcile = defineAction({
  name: 'reconcile',
  *generate() {
    yield {
      weight: 3,
      act: (s: IndexesSurface) => runReconcile(s),
    };
  },
});

export const advanceClock = defineAction({
  name: 'advanceClock',
  *generate() {
    const days = yield* draw(gen(fc.constantFrom(1, 2, 40)));
    yield {
      weight: 1,
      act: (s: IndexesSurface) => {
        reconcilerOf(s).clock.advance(days * 24 * 60 * 60 * 1000);
      },
    };
  },
});

export const setManifest = defineAction({
  name: 'setManifest',
  *generate() {
    const mode = yield* draw(gen(fc.constantFrom('user', 'owner', 'empty')));
    yield {
      weight: 3,
      act: (s: IndexesSurface) => {
        const state = reconcilerOf(s);
        if (mode === 'empty') {
          state.manifest = emptyManifest();
          return;
        }
        const col = mode === 'user' ? 'user_id' : 'owner_id';
        state.manifest = manifestForCol('notes', col);
      },
    };
  },
});

export const bumpUsage = defineAction({
  name: 'bumpUsage',
  *generate() {
    const n = yield* ownedIndexCount;
    if (n === 0) return;
    yield {
      weight: 1,
      act: (s: IndexesSurface) => {
        const state = reconcilerOf(s);
        const names = state.db.getOwnedIndexNames();
        if (names.length > 0) {
          state.db.bumpScans(names[0]!, 1);
        }
      },
    };
  },
});

export const externalAdd = defineAction({
  name: 'externalAdd',
  *generate() {
    yield {
      weight: 1,
      act: (s: IndexesSurface) => {
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
    };
  },
});

export const INDEXES_ACTIONS = [
  reconcile,
  advanceClock,
  setManifest,
  bumpUsage,
  externalAdd,
];

export const invariantsHold = defineProperty({
  name: 'invariants',
  *watch() {
    while (true) {
      const v = (yield invariantViolations) as string[];
      if (v.length > 0) throw new Error(v[0]!);
    }
  },
});

export const INDEXES_PROPERTIES = [invariantsHold];
