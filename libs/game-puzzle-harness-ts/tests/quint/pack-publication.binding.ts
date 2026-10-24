import type { ContentHarness } from '@libs/game-puzzle-harness-ts/content-system';
import {
  contentDeviceOffline,
  contentDeviceOnline,
  reopenContentDevice,
} from '@libs/game-puzzle-harness-ts/offline-actions';
import {
  publishPackPuzzleEdition,
  savePackPublicationDraft,
  setupPackPublication,
  withdrawPackPuzzleEdition,
} from '@libs/game-puzzle-harness-ts/pack-publication-lifecycle-actions';
import { packPublicationState } from '@libs/game-puzzle-harness-ts/pack-publication-lifecycle-observations';
import {
  publishSavedContentDraft,
  withdrawPublication,
} from '@libs/game-puzzle-harness-ts/publication-lifecycle-actions';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import withdrawalTrace from './fixtures/pack-withdrawal-observation.itf.json';
import collisionTrace from './fixtures/reopen-during-http-work.itf.json';

bindQuintModel<Run<ContentHarness>>({
  model: 'pack-publication',
  traces: 24,
  maxSteps: 32,
  regressions: [
    // regression: sync-harness-retired-http-accepts-new-requests
    {
      id: 'sync-harness-retired-http-accepts-new-requests',
      title: 'Repeated reopenings retire the earlier HTTP client',
      seed: '0x67932',
      itf: collisionTrace,
    },
    // regression: puzzle-withdrawal-observation-uses-retained-edition
    {
      id: 'puzzle-withdrawal-observation-uses-retained-edition',
      title: 'Withdrawing a pack hides its retained edition',
      seed: '0x67932',
      itf: withdrawalTrace,
    },
  ],
  actions: {
    init: (run) => run.apply(setupPackPublication),
    savePackDraft: (run, picks) =>
      run.apply(savePackPublicationDraft, picks['order'] as number[]),
    publishPack: (run, picks) =>
      run.apply(
        publishSavedContentDraft,
        String(picks['person']),
        Number(picks['draft'])
      ),
    withdrawPack: (run, picks) =>
      run.apply(withdrawPublication, String(picks['person'])),
    publishPackPuzzle: (run, picks) =>
      run.apply(publishPackPuzzleEdition, Number(picks['puzzle'])),
    withdrawPackPuzzle: (run, picks) =>
      run.apply(withdrawPackPuzzleEdition, Number(picks['puzzle'])),
    reopenApp: (run) => run.apply(reopenContentDevice, 'alice:phone'),
    _loseConnection: (run) => run.apply(contentDeviceOffline, 'alice:phone'),
    connectionReturns: (run) => run.apply(contentDeviceOnline, 'alice:phone'),
  },
  observe: (run) => run.read(packPublicationState),
});
