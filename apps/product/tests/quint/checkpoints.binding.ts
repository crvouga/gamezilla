/**
 * `specs/developer-tools/checkpoints.qnt` against the testing tool.
 * Saving, an interrupted save, a changed app, a failed restore, deletion,
 * and closing and opening the tool are the actions the scenarios run.
 */

import {
  changeInvestigatedApp,
  checkpointOperation,
  failCheckpointRestore,
  interruptNextCheckpointSave,
  investigatePeople,
  reopenTestingTool,
  saveCheckpoint,
  sharedCheckpointView,
} from '@apps/product/developer-checkpoints';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import interruptedAfterFailure from './fixtures/checkpoint-interrupted-save-clears-restore-failure.itf.json';
import repeatedLabel from './fixtures/checkpoint-repeated-label-identity.itf.json';

const LABEL = 'Before the invitation';

bindQuintModel<QuintHarnessWorld>({
  model: 'checkpoints',
  traces: 24,
  maxSteps: 6,
  timeoutMs: 180_000,
  regressions: [
    {
      // regression: checkpoint-repeated-label-identity
      id: 'checkpoint-repeated-label-identity',
      title: 'Deleting the latest checkpoint does not select an older namesake',
      seed: '0x67932',
      itf: repeatedLabel,
    },
    {
      // regression: checkpoint-interrupted-save-clears-restore-failure
      id: 'checkpoint-interrupted-save-clears-restore-failure',
      title:
        'Starting a save clears an earlier restore failure even if saving is interrupted',
      seed: '0x67932',
      itf: interruptedAfterFailure,
    },
  ],
  actions: {
    init: (w) => w.s.apply(investigatePeople),
    saveCheckpoint: (w) => w.s.apply(saveCheckpoint, LABEL),
    interruptSave: async (w) => {
      await w.s.apply(interruptNextCheckpointSave);
      await w.s.apply(saveCheckpoint, 'Interrupted').catch(() => undefined);
    },
    changeWorld: (w) => w.s.apply(changeInvestigatedApp),
    failRestore: (w) => w.s.apply(failCheckpointRestore, LABEL),
    deleteCheckpoint: async (w) => {
      await w.s.apply(checkpointOperation, 'delete', LABEL);
      await w.s.apply(checkpointOperation, 'confirm-delete');
    },
    reopenTool: (w) => w.s.apply(reopenTestingTool),
  },
  observe: (w) => w.quiet.read(sharedCheckpointView, LABEL),
});
