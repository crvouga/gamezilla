import type { ContentHarness } from '@libs/game-puzzle-harness-ts/content-system';
import { changeGameRules } from '@libs/game-puzzle-harness-ts/edition-rules-actions';
import {
  editionRulesState,
  publishRiverEdition,
  resumeRiverEdition,
  setupEditionRules,
  startRiverEdition,
} from '@libs/game-puzzle-harness-ts/edition-rules-lifecycle';
import {
  contentDeviceOffline,
  contentDeviceOnline,
} from '@libs/game-puzzle-harness-ts/offline-actions';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

bindQuintModel<Run<ContentHarness>>({
  model: 'edition-rules',
  traces: 16,
  maxSteps: 12,
  actions: {
    init: (run) => run.apply(setupEditionRules),
    publishPuzzle: (run) => run.apply(publishRiverEdition),
    startPuzzle: (run, picks) =>
      run.apply(startRiverEdition, Number(picks['edition'])),
    resumeAttempt: (run, picks) =>
      run.apply(resumeRiverEdition, Number(picks['edition'])),
    rulesChange: (run) => run.apply(changeGameRules),
    _loseConnection: (run) => run.apply(contentDeviceOffline, 'bob:phone'),
    connectionReturns: (run) => run.apply(contentDeviceOnline, 'bob:phone'),
  },
  observe: (run) => run.read(editionRulesState),
});
