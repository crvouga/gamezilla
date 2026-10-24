import type { ContentHarness } from '@libs/game-puzzle-harness-ts/content-system';
import {
  contentDeviceOffline,
  contentDeviceOnline,
  reopenContentDevice,
} from '@libs/game-puzzle-harness-ts/offline-actions';
import {
  chooseRecoveryPublication,
  republishRecoveryPuzzle,
  setupPublicationRecovery,
  withdrawChosenRecoveryPuzzle,
} from '@libs/game-puzzle-harness-ts/publication-recovery-actions';
import { publicationRecoveryState } from '@libs/game-puzzle-harness-ts/publication-recovery-observations';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import reopenTrace from './fixtures/republication-after-offline-reopen.itf.json';

bindQuintModel<Run<ContentHarness>>({
  model: 'publication-recovery',
  traces: 24,
  maxSteps: 32,
  regressions: [
    // regression: puzzle-republication-after-offline-reopen-is-unavailable
    {
      id: 'puzzle-republication-after-offline-reopen-is-unavailable',
      title: 'The chosen puzzle can be republished after offline reopenings',
      seed: '0x67932',
      itf: reopenTrace,
    },
  ],
  actions: {
    init: (run) => run.apply(setupPublicationRecovery),
    publishPack: (run) => run.apply(chooseRecoveryPublication),
    withdrawChosenPuzzle: (run) =>
      run.apply(withdrawChosenRecoveryPuzzle, 'River'),
    republishChosenPuzzle: (run) => run.apply(republishRecoveryPuzzle, 'River'),
    reopenApp: (run) => run.apply(reopenContentDevice, 'alice:phone'),
    _loseConnection: (run) => run.apply(contentDeviceOffline, 'alice:phone'),
    connectionReturns: (run) => run.apply(contentDeviceOnline, 'alice:phone'),
  },
  observe: (run) => run.read(publicationRecoveryState),
});
