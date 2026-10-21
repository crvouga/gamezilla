import { controlLichessFileSave } from '@libs/chess-root-harness-ts/lichess-file-actions';
import {
  askToLeaveAddingPuzzles,
  cancelLeavingAddingPuzzles,
  confirmLeavingAddingPuzzles,
  prepareLichessDeparture,
  readLichessDeparture,
} from '@libs/chess-root-harness-ts/lichess-file-departure';
import { losePuzzleLoadingConnection } from '@libs/chess-root-harness-ts/puzzle-file-preparation';
import { followPuzzleImport } from '@libs/chess-root-harness-ts/puzzle-import-ui';
import { restoreActorConnection } from '@libs/harness-ts/actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

bindQuintModel<QuintHarnessWorld>({
  model: 'lichess-file-leaving',
  traces: 32,
  maxSteps: 12,
  actions: {
    init: (w) => w.s.apply(prepareLichessDeparture),
    askToLeaveAddingPuzzles: (w) => w.s.apply(askToLeaveAddingPuzzles),
    cancelLeavingAddingPuzzles: (w) => w.s.apply(cancelLeavingAddingPuzzles),
    confirmLeavingAddingPuzzles: (w) => w.s.apply(confirmLeavingAddingPuzzles),
    finishSavingLichessFile: (w) => w.s.apply(controlLichessFileSave, null),
    leaveAddingPuzzles: (w) => w.s.apply(askToLeaveAddingPuzzles),
    returnToLichessFile: (w) => w.s.apply(followPuzzleImport, 'alice'),
    loseConnection: (w) => w.s.apply(losePuzzleLoadingConnection),
    comeBackOnline: (w) => w.s.apply(restoreActorConnection, 'alice'),
  },
  observe: (w) => w.quiet.read(readLichessDeparture),
});
