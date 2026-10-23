import {
  followPuzzleImport,
  readPuzzleImport,
  seedPuzzleRefreshPool,
  startPuzzleLoading,
  stopPuzzleLoading,
} from '@libs/chess-root-harness-ts/puzzle-import-ui';
import {
  advancePuzzleImport,
  failPuzzleImport,
  finishPuzzleImport,
  joinPuzzleTeam,
} from '@libs/chess-root-harness-ts/puzzle-import-world';
import { partition, restoreActorConnection } from '@libs/harness-ts/actions';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import staleDelivery from './fixtures/puzzle-load-stale-delivery.itf.json';

bindQuintModel<QuintHarnessWorld>({
  model: 'puzzle-loading',
  traces: 24,
  maxSteps: 12,
  regressions: [
    {
      // regression: puzzle-load-stale-delivery
      id: 'puzzle-load-stale-delivery',
      title: 'A saved-source load finishes after an earlier load was stopped',
      seed: '0x67932',
      itf: staleDelivery,
    },
  ],
  actions: {
    init: async (w) => {
      await w.s.apply(seedPuzzleRefreshPool);
      await w.s.apply(signInWithGoogle, 'alice');
      await w.s.apply(joinPuzzleTeam, 'alice');
      await w.s.apply(followPuzzleImport, 'alice');
      await w.s.until((s) => readPuzzleImport(s, 'alice'), {
        pred: (view) => !view.denied,
        maxMs: 15000,
      });
    },
    addPuzzles: (w) => w.s.apply(startPuzzleLoading, 'alice'),
    addSomePuzzles: (w) => w.s.apply(advancePuzzleImport),
    finishAddingPuzzles: (w) => w.s.apply(finishPuzzleImport),
    failAddingPuzzles: (w) => w.s.apply(failPuzzleImport),
    stopAddingPuzzles: (w) => w.s.apply(stopPuzzleLoading, 'alice'),
    followAddingPuzzles: (w) => w.s.apply(followPuzzleImport, 'alice'),
    loseConnection: (w) => w.s.apply(partition, 'alice'),
    comeBackOnline: (w) => w.s.apply(restoreActorConnection, 'alice'),
  },
  observe: async (w) => {
    const view = await w.quiet.read(readPuzzleImport, 'alice');
    return {
      puzzleLoading: {
        status: view.status,
        added: view.added,
        updated: view.updated,
        broken: view.broken,
      },
      online: !view.offline,
    };
  },
});
