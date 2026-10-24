import { changeContentAttempt } from '@libs/game-puzzle-harness-ts/attempt-actions';
import {
  advanceLifecycleAttempt,
  publishAttemptPuzzleEdition,
  restartLifecycleAttempt,
  resumeLifecycleAttempt,
  setupAttemptLifecycle,
  startLifecycleAttempt,
  withdrawAttemptPuzzle,
} from '@libs/game-puzzle-harness-ts/attempt-lifecycle-actions';
import { attemptLifecycleState } from '@libs/game-puzzle-harness-ts/attempt-lifecycle-observations';
import type { ContentHarness } from '@libs/game-puzzle-harness-ts/content-system';
import {
  contentDeviceOffline,
  contentDeviceOnline,
  reopenContentDevice,
} from '@libs/game-puzzle-harness-ts/offline-actions';
import { continueEarlierLifecycleAttempt } from '@libs/game-puzzle-harness-ts/stale-editor-actions';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

bindQuintModel<Run<ContentHarness>>({
  model: 'puzzle-attempt',
  traces: 24,
  maxSteps: 32,
  actions: {
    init: (run) => run.apply(setupAttemptLifecycle),
    continueEarlierAttempt: (run) => run.apply(continueEarlierLifecycleAttempt),
    startPuzzle: (run) => run.apply(startLifecycleAttempt),
    advanceAttempt: (run) => run.apply(advanceLifecycleAttempt),
    undoAttempt: (run) =>
      run.apply(changeContentAttempt, 'bob:phone', { kind: 'undo' }),
    redoAttempt: (run) =>
      run.apply(changeContentAttempt, 'bob:phone', { kind: 'redo' }),
    restartPuzzle: (run) => run.apply(restartLifecycleAttempt),
    resumeAttempt: (run, picks) =>
      run.apply(resumeLifecycleAttempt, Number(picks['attempt'])),
    publishPuzzleEdition: (run) => run.apply(publishAttemptPuzzleEdition),
    withdrawPuzzle: (run) => run.apply(withdrawAttemptPuzzle),
    reopenApp: (run) => run.apply(reopenContentDevice, 'bob:phone'),
    _loseConnection: (run) => run.apply(contentDeviceOffline, 'bob:phone'),
    connectionReturns: (run) => run.apply(contentDeviceOnline, 'bob:phone'),
  },
  observe: (run) => run.read(attemptLifecycleState),
});
