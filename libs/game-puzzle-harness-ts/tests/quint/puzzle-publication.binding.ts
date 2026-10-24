import type { ContentHarness } from '@libs/game-puzzle-harness-ts/content-system';
import {
  contentDeviceOffline,
  contentDeviceOnline,
  reopenContentDevice,
} from '@libs/game-puzzle-harness-ts/offline-actions';
import {
  choosePublicationDraft,
  publishSavedContentDraft,
  savePublicationDraft,
  setupPuzzlePublication,
  withdrawPublication,
} from '@libs/game-puzzle-harness-ts/publication-lifecycle-actions';
import { puzzlePublicationState } from '@libs/game-puzzle-harness-ts/publication-lifecycle-observations';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

bindQuintModel<Run<ContentHarness>>({
  model: 'puzzle-publication',
  traces: 24,
  maxSteps: 32,
  actions: {
    init: (run) => run.apply(setupPuzzlePublication),
    savePuzzleDraft: (run, picks) =>
      run.apply(
        savePublicationDraft,
        String(picks['person']),
        String(picks['title']),
        picks['valid'] === true
      ),
    choosePuzzleDraft: (run, picks) =>
      run.apply(
        choosePublicationDraft,
        String(picks['person']),
        Number(picks['draft'])
      ),
    publishPuzzle: (run, picks) =>
      run.apply(
        publishSavedContentDraft,
        String(picks['person']),
        Number(picks['draft'])
      ),
    withdrawPuzzle: (run, picks) =>
      run.apply(withdrawPublication, String(picks['person'])),
    reopenApp: (run) => run.apply(reopenContentDevice, 'alice:phone'),
    _loseConnection: (run) => run.apply(contentDeviceOffline, 'alice:phone'),
    connectionReturns: (run) => run.apply(contentDeviceOnline, 'alice:phone'),
  },
  observe: (run) => run.read(puzzlePublicationState),
});
