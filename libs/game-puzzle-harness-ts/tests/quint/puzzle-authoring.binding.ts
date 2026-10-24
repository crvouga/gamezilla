import { playtestContentDraft } from '@libs/game-puzzle-harness-ts/attempt-actions';
import { finishContentAttempt } from '@libs/game-puzzle-harness-ts/attempt-fixtures';
import {
  saveAuthoringDraft,
  setupPrivatePuzzleAuthoring,
} from '@libs/game-puzzle-harness-ts/authoring-lifecycle-actions';
import { privatePuzzleAuthoringState } from '@libs/game-puzzle-harness-ts/authoring-lifecycle-observations';
import {
  createContentDraft,
  openContentDraft,
} from '@libs/game-puzzle-harness-ts/content-actions';
import { validateContent } from '@libs/game-puzzle-harness-ts/content-publication-actions';
import type { ContentHarness } from '@libs/game-puzzle-harness-ts/content-system';
import {
  contentDeviceOffline,
  contentDeviceOnline,
  reopenContentDevice,
} from '@libs/game-puzzle-harness-ts/offline-actions';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

bindQuintModel<Run<ContentHarness>>({
  model: 'puzzle-authoring',
  traces: 24,
  maxSteps: 32,
  actions: {
    init: (run) => run.apply(setupPrivatePuzzleAuthoring),
    createPuzzleDraft: (run) =>
      run.apply(createContentDraft, 'alice:phone', 'River'),
    saveAuthoringDraft: (run, picks) =>
      run.apply(saveAuthoringDraft, {
        person: String(picks['person']),
        title: String(picks['title']),
        valid: picks['valid'] === true,
        described: picks['described'] === true,
      }),
    inspectPuzzleDraft: (run, picks) =>
      run.apply(
        openContentDraft,
        `${String(picks['person']).toLowerCase()}:phone`,
        'River'
      ),
    validateDraft: (run) => run.apply(validateContent),
    beginPlaytest: (run, picks) =>
      run.apply(
        playtestContentDraft,
        `${String(picks['person']).toLowerCase()}:phone`
      ),
    completePlaytest: (run) => run.apply(finishContentAttempt, 'alice:phone'),
    reopenApp: (run) => run.apply(reopenContentDevice, 'alice:phone'),
    _loseConnection: (run) => run.apply(contentDeviceOffline, 'alice:phone'),
    connectionReturns: (run) => run.apply(contentDeviceOnline, 'alice:phone'),
  },
  observe: (run) => run.read(privatePuzzleAuthoringState),
});
