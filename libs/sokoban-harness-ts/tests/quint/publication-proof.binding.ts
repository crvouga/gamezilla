import {
  contentDeviceOffline,
  contentDeviceOnline,
} from '@libs/game-puzzle-harness-ts/offline-actions';
import {
  changeSokobanRules,
  completeSokobanPlaytest,
  playtestSokobanDraft,
  publishSokobanDraft,
  stopSokobanPlaytest,
} from '@libs/sokoban-harness-ts/sokoban-proof';
import {
  editProofBoard,
  editProofDetails,
  publicationProofState,
  setupPublicationProof,
} from '@libs/sokoban-harness-ts/sokoban-proof-model';
import type { SokobanHarness } from '@libs/sokoban-harness-ts/sokoban-system';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

const ALICE = 'alice:phone';

bindQuintModel<Run<SokobanHarness>>({
  model: 'publication-proof',
  traces: 12,
  maxSteps: 10,
  actions: {
    init: (run) => run.apply(setupPublicationProof),
    editBoard: (run, picks) =>
      run.apply(editProofBoard, Number(picks['newBoard'])),
    editDetails: (run, picks) =>
      run.apply(editProofDetails, Number(picks['newDetails'])),
    beginPlaytest: (run) => run.apply(playtestSokobanDraft),
    completePlaytest: (run) => run.apply(completeSokobanPlaytest),
    leavePlaytest: (run) => run.apply(stopSokobanPlaytest),
    publishPuzzle: (run) => run.apply(publishSokobanDraft),
    rulesChange: (run) => run.apply(changeSokobanRules),
    _loseConnection: (run) => run.apply(contentDeviceOffline, ALICE),
    connectionReturns: (run) => run.apply(contentDeviceOnline, ALICE),
  },
  observe: (run) => run.read(publicationProofState),
});
