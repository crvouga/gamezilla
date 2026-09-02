import { actions } from '@pkgs/dst';
import fc from 'fast-check';
import { reconcileIndexes } from '../../core/reconcile';
import type { WorkloadManifest } from '../../core/types';
import { manifestForCol } from './invariants';
import type { IndexesSurface } from './types';
import { reconcilerOf } from './types';

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

export const INDEXES_ACTIONS = actions<IndexesSurface>()({
  reconcile: {
    weight: 3,
    generate: () => fc.constant({ kind: 'reconcile' as const }),
    apply: async (surface) => {
      const state = reconcilerOf(surface);
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
    },
  },
  advanceClock: {
    weight: 1,
    generate: () =>
      fc.record({
        kind: fc.constant('advanceClock' as const),
        days: fc.constantFrom(1, 2, 40),
      }),
    apply: async (surface, payload) => {
      const action = payload as AdvanceClockAction;
      reconcilerOf(surface).clock.advance(action.days * 24 * 60 * 60 * 1000);
    },
  },
  setManifest: {
    weight: 3,
    generate: () =>
      fc.record({
        kind: fc.constant('setManifest' as const),
        mode: fc.constantFrom('user', 'owner', 'empty'),
      }),
    apply: async (surface, payload) => {
      const action = payload as SetManifestAction;
      const state = reconcilerOf(surface);
      if (action.mode === 'empty') {
        state.manifest = emptyManifest();
        return;
      }
      const col = action.mode === 'user' ? 'user_id' : 'owner_id';
      state.manifest = manifestForCol('notes', col);
    },
  },
  bumpUsage: {
    weight: 1,
    generate: () => fc.constant({ kind: 'bumpUsage' as const }),
    apply: async (surface) => {
      const state = reconcilerOf(surface);
      const names = state.db.getOwnedIndexNames();
      if (names.length > 0) {
        state.db.bumpScans(names[0]!, 1);
      }
    },
  },
  externalAdd: {
    weight: 1,
    generate: () => fc.constant({ kind: 'externalAdd' as const }),
    apply: async (surface) => {
      reconcilerOf(surface).db.externalAddIndex({
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
  },
});
