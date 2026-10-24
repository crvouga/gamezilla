import type { ContentHarness } from '@libs/game-puzzle-harness-ts/content-system';
import {
  contentDeviceOffline,
  contentDeviceOnline,
  reopenContentDevice,
} from '@libs/game-puzzle-harness-ts/offline-actions';
import { openPublishedPack } from '@libs/game-puzzle-harness-ts/pack-play-actions';
import {
  completeProgressionPuzzle,
  continueProgressionPack,
  restartProgressionPuzzle,
  setupPackProgression,
  startProgressionPuzzle,
} from '@libs/game-puzzle-harness-ts/progression-lifecycle-actions';
import { progressionLifecycleState } from '@libs/game-puzzle-harness-ts/progression-lifecycle-observations';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import sameTimeTrace from './fixtures/same-time-pack-resume.itf.json';

bindQuintModel<Run<ContentHarness>>({
  model: 'pack-progression',
  traces: 24,
  maxSteps: 32,
  regressions: [
    // regression: pack-resume-selects-earlier-puzzle-at-equal-time
    {
      id: 'pack-resume-selects-earlier-puzzle-at-equal-time',
      title: 'Continue offers the last puzzle chosen within the same instant',
      seed: '0x67932',
      itf: sameTimeTrace,
    },
  ],
  actions: {
    init: (run) => run.apply(setupPackProgression),
    openPack: (run) => run.apply(openPublishedPack, 'bob:phone', 'Rivers'),
    startPackPuzzle: (run, picks) =>
      run.apply(startProgressionPuzzle, Number(picks['puzzle'])),
    completePackPuzzle: (run) => run.apply(completeProgressionPuzzle),
    restartPackPuzzle: (run) => run.apply(restartProgressionPuzzle),
    continuePack: (run) => run.apply(continueProgressionPack),
    reopenApp: (run) => run.apply(reopenContentDevice, 'bob:phone'),
    _loseConnection: (run) => run.apply(contentDeviceOffline, 'bob:phone'),
    connectionReturns: (run) => run.apply(contentDeviceOnline, 'bob:phone'),
  },
  observe: (run) => run.read(progressionLifecycleState),
});
