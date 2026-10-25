import { copyContentEditorToTablet } from '@libs/game-puzzle-harness-ts/content-actions';
import type { ContentHarness } from '@libs/game-puzzle-harness-ts/content-system';
import {
  redoDraftEditThroughScreen,
  saveEditingDraftThroughScreen,
  setupDraftEditing,
  undoDraftEditThroughScreen,
} from '@libs/game-puzzle-harness-ts/draft-history-actions';
import { draftEditingState } from '@libs/game-puzzle-harness-ts/draft-history-observations';
import {
  contentDeviceOffline,
  contentDeviceOnline,
  reopenContentDevice,
} from '@libs/game-puzzle-harness-ts/offline-actions';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import type { QuintValue } from '@pkgs/quint-shared-ts/itf';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

function savedDraft(saved: QuintValue | undefined) {
  const record = (saved ?? {}) as Readonly<Record<string, QuintValue>>;
  return {
    title: String(record['title']),
    valid: record['valid'] === true,
    contents: ((record['contents'] ?? []) as readonly QuintValue[]).map(String),
  };
}

bindQuintModel<Run<ContentHarness>>({
  model: 'draft-editing',
  traces: 12,
  maxSteps: 12,
  actions: {
    init: async (run, picks) => {
      await run.apply(
        setupDraftEditing,
        picks['kind'] === 'pack' ? 'pack' : 'puzzle'
      );
      await run.apply(copyContentEditorToTablet);
    },
    saveAuthoringDraft: (run, picks) =>
      run.apply(
        saveEditingDraftThroughScreen,
        'alice:phone',
        savedDraft(picks['saved'])
      ),
    undoDraftEdit: (run) =>
      run.apply(undoDraftEditThroughScreen, 'alice:phone'),
    redoDraftEdit: (run) =>
      run.apply(redoDraftEditThroughScreen, 'alice:phone'),
    reopenApp: (run) => run.apply(reopenContentDevice, 'alice:phone'),
    _loseConnection: (run) => run.apply(contentDeviceOffline, 'alice:phone'),
    connectionReturns: (run) => run.apply(contentDeviceOnline, 'alice:phone'),
  },
  observe: (run) => run.read(draftEditingState),
});
