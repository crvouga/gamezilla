import {
  askToStopPuzzleLoading,
  cancelStoppingPuzzleLoading,
  confirmStoppingPuzzleLoading,
  controlStoppingPuzzleLoading,
} from '@libs/chess-root-harness/lichess-file-actions';
import { losePuzzleLoadingConnection } from '@libs/chess-root-harness/puzzle-file-preparation';
import {
  failPuzzleImport,
  finishPuzzleImport,
} from '@libs/chess-root-harness/puzzle-import-world';
import {
  followPuzzleStopChoice,
  preparePuzzleStopChoice,
  readPuzzleStopChoice,
} from '@libs/chess-root-harness/puzzle-stop-choice';
import { failStoppingPuzzleLoading } from '@libs/chess-root-harness/puzzle-stop-failure';
import { restoreActorConnection } from '@libs/harness/actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

import pendingStop from './fixtures/puzzle-stop-awaits-verdict.itf.json';

bindQuintModel<QuintHarnessWorld>({
  model: 'puzzle-loading-choices',
  regressions: [
    {
      // regression: puzzle-stop-awaits-verdict
      id: 'puzzle-stop-awaits-verdict',
      title: 'A pending stop does not claim completion',
      seed: '0x67932',
      itf: pendingStop,
    },
  ],
  traces: 48,
  maxSteps: 18,
  actions: {
    init: (w, picks) =>
      w.s.apply(preparePuzzleStopChoice, String(picks['_choice'])),
    askToStopAddingPuzzles: (w) => w.s.apply(askToStopPuzzleLoading),
    cancelStoppingPuzzles: (w) => w.s.apply(cancelStoppingPuzzleLoading),
    confirmStoppingPuzzles: async (w) => {
      await w.s.apply(controlStoppingPuzzleLoading, 'hold');
      await w.s.apply(confirmStoppingPuzzleLoading);
    },
    finishStoppingPuzzles: (w) => w.s.apply(controlStoppingPuzzleLoading, null),
    failStoppingPuzzles: (w) => w.s.apply(failStoppingPuzzleLoading),
    finishAddingPuzzles: (w) => w.s.apply(finishPuzzleImport),
    failAddingPuzzles: (w) => w.s.apply(failPuzzleImport),
    followAddingPuzzles: (w) => w.s.apply(followPuzzleStopChoice),
    loseConnection: (w) => w.s.apply(losePuzzleLoadingConnection),
    comeBackOnline: (w) => w.s.apply(restoreActorConnection, 'alice'),
  },
  observe: (w) => w.quiet.read(readPuzzleStopChoice),
});
