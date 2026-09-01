import { defineAction } from '@pkgs/determinism';
import fc from 'fast-check';
import { reconcileIndexes } from '../../core/reconcile';
import type { WorkloadManifest } from '../../core/types';
import { manifestForCol } from './invariants';
import type { IndexesModel, IndexesSystem } from './types';

function emptyManifest(): WorkloadManifest {
  return { version: 1, queries: [] };
}

export type ReconcileAction = {
  readonly kind: 'reconcile';
};

export type AdvanceClockAction = {
  readonly kind: 'advanceClock';
  readonly days: number;
};

export type SetManifestAction = {
  readonly kind: 'setManifest';
  readonly mode: 'user' | 'owner' | 'empty';
};

export type BumpUsageAction = {
  readonly kind: 'bumpUsage';
};

export type ExternalAddAction = {
  readonly kind: 'externalAdd';
};

const CFG = {
  minTableRows: 1,
  createEstimatedMs: 10,
  dropEstimatedMs: 10,
  metaEstimatedMs: 1,
  deprecationWindowDays: 1,
  maxBuildsPerRun: 3,
  maxIndexesPerTable: 6,
} as const;

export const reconcileAction = defineAction<
  IndexesSystem,
  ReconcileAction,
  IndexesModel
>({
  kind: 'reconcile',
  class: 'domain',
  arb: () => fc.constant({ kind: 'reconcile' as const }),
  dispatch: async (world) => {
    const state = world.state;
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
        // Crash-convergence: fork and fault-free settle
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
  },
  apply: (m) => {
    m.cycleCount += 1;
  },
});

export const advanceClockAction = defineAction<
  IndexesSystem,
  AdvanceClockAction,
  IndexesModel
>({
  kind: 'advanceClock',
  class: 'library',
  arb: () =>
    fc.record({
      kind: fc.constant('advanceClock' as const),
      days: fc.constantFrom(1, 2, 40),
    }),
  dispatch: async (world, action) => {
    world.state.clock.advance(action.days * 24 * 60 * 60 * 1000);
  },
});

export const setManifestAction = defineAction<
  IndexesSystem,
  SetManifestAction,
  IndexesModel
>({
  kind: 'setManifest',
  class: 'domain',
  arb: () =>
    fc.record({
      kind: fc.constant('setManifest' as const),
      mode: fc.constantFrom('user', 'owner', 'empty'),
    }),
  dispatch: async (world, action) => {
    if (action.mode === 'empty') {
      world.state.manifest = emptyManifest();
      return;
    }
    const col = action.mode === 'user' ? 'user_id' : 'owner_id';
    world.state.manifest = manifestForCol('notes', col);
  },
});

export const bumpUsageAction = defineAction<
  IndexesSystem,
  BumpUsageAction,
  IndexesModel
>({
  kind: 'bumpUsage',
  class: 'library',
  arb: () => fc.constant({ kind: 'bumpUsage' as const }),
  dispatch: async (world) => {
    const names = world.state.db.getOwnedIndexNames();
    if (names.length > 0) {
      world.state.db.bumpScans(names[0]!, 1);
    }
  },
});

export const externalAddAction = defineAction<
  IndexesSystem,
  ExternalAddAction,
  IndexesModel
>({
  kind: 'externalAdd',
  class: 'library',
  arb: () => fc.constant({ kind: 'externalAdd' as const }),
  dispatch: async (world) => {
    world.state.db.externalAddIndex({
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

export const INDEXES_ACTIONS = [
  reconcileAction,
  advanceClockAction,
  setManifestAction,
  bumpUsageAction,
  externalAddAction,
] as const;
