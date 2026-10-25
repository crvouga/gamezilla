import {
  contentDeviceOffline,
  contentDeviceOnline,
} from '@libs/game-puzzle-harness-ts/offline-actions';
import { completeSokobanPuzzle } from '@libs/sokoban-harness-ts/sokoban-play';
import {
  continueStarterPack,
  startFreshStarterPuzzle,
} from '@libs/sokoban-harness-ts/sokoban-starter';
import { starterPackState } from '@libs/sokoban-harness-ts/sokoban-starter-model';
import type { SokobanHarness } from '@libs/sokoban-harness-ts/sokoban-system';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

const BOB = 'bob:phone';

bindQuintModel<Run<SokobanHarness>>({
  model: 'starter-pack',
  traces: 12,
  maxSteps: 10,
  actions: {
    init: () => Promise.resolve(),
    playStarterPuzzle: (run, picks) =>
      run.apply(startFreshStarterPuzzle, BOB, Number(picks['puzzle'])),
    completeStarterPuzzle: (run) => run.apply(completeSokobanPuzzle, BOB),
    continueStarterPack: (run) => run.apply(continueStarterPack, BOB),
    _loseConnection: (run) => run.apply(contentDeviceOffline, BOB),
    connectionReturns: (run) => run.apply(contentDeviceOnline, BOB),
  },
  observe: (run) => run.read(starterPackState),
});
