import {
  redoDraftEditInBuilder,
  undoDraftEditInBuilder,
} from '@libs/game-puzzle-harness-ts/builder-session';
import type { ContentHarness } from '@libs/game-puzzle-harness-ts/content-system';
import {
  draftEditingState,
  type EditingDraft,
  saveEditingDraft,
  setupDraftEditing,
} from '@libs/game-puzzle-harness-ts/draft-editing-lifecycle';
import {
  contentDeviceOffline,
  contentDeviceOnline,
  reopenContentDevice,
} from '@libs/game-puzzle-harness-ts/offline-actions';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

const ALICE = 'alice:phone';

bindQuintModel<Run<ContentHarness>>({
  model: 'draft-editing',
  traces: 16,
  maxSteps: 12,
  actions: {
    init: (run, picks) =>
      run.apply(
        setupDraftEditing,
        picks['kind'] === 'pack' ? 'pack' : 'puzzle'
      ),
    saveAuthoringDraft: (run, picks) =>
      run.apply(saveEditingDraft, picks['saved'] as EditingDraft),
    undoDraftEdit: (run) => run.apply(undoDraftEditInBuilder, ALICE),
    redoDraftEdit: (run) => run.apply(redoDraftEditInBuilder, ALICE),
    reopenApp: (run) => run.apply(reopenContentDevice, ALICE),
    _loseConnection: (run) => run.apply(contentDeviceOffline, ALICE),
    connectionReturns: (run) => run.apply(contentDeviceOnline, ALICE),
  },
  observe: (run) => run.read(draftEditingState),
});
