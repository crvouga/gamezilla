import {
  askToStopPuzzleLoading,
  cancelStoppingPuzzleLoading,
  chooseLichessFile,
  confirmStoppingPuzzleLoading,
  controlLichessFileCheck,
  controlLichessFileSave,
  saveChosenLichessFile,
} from '@libs/chess-root-harness-ts/lichess-file-actions';
import {
  beginCheckingLichessFile,
  beginReturningToLichessFile,
  failSavingLichessFile,
  losePuzzleLoadingConnection,
  prepareLichessFileCheck,
  readLichessFilePreparation,
} from '@libs/chess-root-harness-ts/puzzle-file-preparation';
import { saveFirstLichessFileElsewhere } from '@libs/chess-root-harness-ts/puzzle-import-environments';
import { startPuzzleLoading } from '@libs/chess-root-harness-ts/puzzle-import-ui';
import { restoreActorConnection } from '@libs/harness-ts/actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

import regression0 from './fixtures/lichess-check-interrupted.itf.json';
import regression1 from './fixtures/lichess-choice-clears-stop-error.itf.json';
import regression2 from './fixtures/lichess-file-saved-elsewhere.itf.json';

bindQuintModel<QuintHarnessWorld>({
  model: 'lichess-file-preparation',
  regressions: [
    {
      // regression: lichess-check-interrupted
      id: 'lichess-check-interrupted',
      title: 'An interrupted later check does not claim the file is missing.',
      seed: '0x67932',
      itf: regression0,
    },
    {
      // regression: lichess-choice-clears-stop-error
      id: 'lichess-choice-clears-stop-error',
      title: 'Choosing another file clears the preceding stopped-save outcome.',
      seed: '0x67932',
      itf: regression1,
    },
    {
      // regression: lichess-file-saved-elsewhere
      id: 'lichess-file-saved-elsewhere',
      title: 'A stale first-file choice reuses the complete shared file.',
      seed: '0x67932',
      itf: regression2,
    },
  ],
  traces: 96,
  maxSteps: 18,
  actions: {
    init: (w, picks) =>
      w.s.apply(prepareLichessFileCheck, String(picks['_initialChoice'])),
    checkLichessFile: (w) => w.s.apply(beginCheckingLichessFile),
    finishCheckingLichessFile: (w) => w.s.apply(controlLichessFileCheck, null),
    failCheckingLichessFile: (w) => w.s.apply(controlLichessFileCheck, 'fail'),
    chooseLichessFile: (w) => w.s.apply(chooseLichessFile),
    saveLichessFile: async (w) => {
      await w.s.apply(controlLichessFileSave, 'hold');
      await w.s.apply(controlLichessFileCheck, 'hold');
      await w.s.apply(saveChosenLichessFile);
    },
    finishSavingLichessFile: async (w) => {
      await w.s.apply(controlLichessFileCheck, null);
      await w.s.apply(controlLichessFileSave, null);
    },
    failSavingLichessFile: (w) => w.s.apply(failSavingLichessFile),
    askToStopSavingLichessFile: (w) => w.s.apply(askToStopPuzzleLoading),
    cancelStoppingLichessFile: (w) => w.s.apply(cancelStoppingPuzzleLoading),
    confirmStoppingLichessFile: (w) => w.s.apply(confirmStoppingPuzzleLoading),
    anotherEnvironmentSavesLichessFile: (w) =>
      w.s.apply(saveFirstLichessFileElsewhere),
    addPuzzles: (w) => w.s.apply(startPuzzleLoading, 'alice'),
    returnToLichessFile: (w) => w.s.apply(beginReturningToLichessFile),
    loseConnection: (w) => w.s.apply(losePuzzleLoadingConnection),
    comeBackOnline: async (w) => {
      await w.s.apply(controlLichessFileCheck, 'hold');
      await w.s.apply(restoreActorConnection, 'alice');
    },
  },
  observe: (w) => w.quiet.read(readLichessFilePreparation),
});
