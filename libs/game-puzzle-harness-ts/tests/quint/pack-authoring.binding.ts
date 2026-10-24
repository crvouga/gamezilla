import { setupPrivatePackAuthoring } from '@libs/game-puzzle-harness-ts/authoring-lifecycle-actions';
import type { ContentHarness } from '@libs/game-puzzle-harness-ts/content-system';
import {
  contentDeviceOffline,
  contentDeviceOnline,
  reopenContentDevice,
} from '@libs/game-puzzle-harness-ts/offline-actions';
import {
  createPackDraft,
  createPuzzleInPack,
} from '@libs/game-puzzle-harness-ts/pack-actions';
import {
  addAuthoringPackPuzzle,
  removeAuthoringPackPuzzle,
  reorderAuthoringPackPuzzle,
} from '@libs/game-puzzle-harness-ts/pack-authoring-lifecycle-actions';
import { privatePackAuthoringState } from '@libs/game-puzzle-harness-ts/pack-authoring-lifecycle-observations';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

bindQuintModel<Run<ContentHarness>>({
  model: 'pack-authoring',
  traces: 24,
  maxSteps: 32,
  actions: {
    init: (run) => run.apply(setupPrivatePackAuthoring),
    createPackDraft: (run) =>
      run.apply(createPackDraft, {
        title: 'Rivers',
        description: 'A gentle beginning',
        titles: [],
      }),
    addPackPuzzle: (run, picks) =>
      run.apply(addAuthoringPackPuzzle, Number(picks['puzzle'])),
    removePackPuzzle: (run, picks) =>
      run.apply(removeAuthoringPackPuzzle, Number(picks['puzzle'])),
    reorderPackPuzzle: (run, picks) =>
      run.apply(
        reorderAuthoringPackPuzzle,
        Number(picks['puzzle']),
        Number(picks['before'])
      ),
    createPackPuzzle: (run) => run.apply(createPuzzleInPack, 'Meadow'),
    reopenApp: (run) => run.apply(reopenContentDevice, 'alice:phone'),
    _loseConnection: (run) => run.apply(contentDeviceOffline, 'alice:phone'),
    connectionReturns: (run) => run.apply(contentDeviceOnline, 'alice:phone'),
  },
  observe: (run) => run.read(privatePackAuthoringState),
});
