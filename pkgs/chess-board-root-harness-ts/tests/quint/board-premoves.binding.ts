import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import type { BoardWorld } from '@pkgs/chess-board-root-harness-ts/board-world';
import {
  configureBoard,
  movePiece,
  readProbe,
  selectSquare,
  setupBoard,
} from '@pkgs/chess-board-root-harness-ts/chess-board';
import { readModelFingerprint } from '@pkgs/chess-board-root-harness-ts/model-evidence';
import {
  clearBoardEvidence,
  pressBoardKey,
} from '@pkgs/chess-board-root-harness-ts/options-actions';
import { REPLACEMENT } from '@pkgs/chess-board-root-harness-ts/positions';
import {
  PREMOVE_READY,
  supplyPremoveReply,
} from '@pkgs/chess-board-root-harness-ts/premove-actions';
import { readPremoveModel } from '@pkgs/chess-board-root-harness-ts/premove-model';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

async function observedInput(w: Run<BoardWorld>, input: () => Promise<void>) {
  await w.apply(clearBoardEvidence);
  await input();
}
bindQuintModel<Run<BoardWorld>>({
  model: 'board-premoves',
  traces: 100,
  maxSteps: 30,
  verifySteps: 4,
  actions: {
    init: (w) =>
      w.apply(setupBoard, {
        fen: PREMOVE_READY,
        premoves: true,
        enableUserArrows: true,
        animations: false,
      }),
    selectPremoveSource: (w, p) =>
      observedInput(w, () => w.apply(selectSquare, p['source'] as Square)),
    queuePremove: (w, p) =>
      observedInput(w, () => {
        const [from, to] = (p['move'] as string).split(' to ') as [
          Square,
          Square,
        ];
        return w.apply(movePiece, from, to);
      }),
    receivePremoveReply: (w) =>
      observedInput(w, async () => {
        const probe = await w.read(readProbe);
        if (probe.pieces.some((p) => p.piece === 'bp' && p.square === 'e7'))
          await w.apply(supplyPremoveReply, 'e7', 'e5');
        else await w.apply(supplyPremoveReply, 'g8', 'f6');
      }),
    invalidatePremove: (w) =>
      observedInput(w, () => w.apply(supplyPremoveReply, 'h2', 'd2')),
    cancelPremoves: (w) =>
      observedInput(w, () => w.apply(pressBoardKey, 'Escape')),
    configurePremoves: (w, p) =>
      observedInput(w, () =>
        w.apply(configureBoard, { premoves: p['canPremove'] as boolean })
      ),
    replacePremovePosition: (w) =>
      observedInput(w, () => w.apply(configureBoard, { fen: REPLACEMENT })),
  },
  observe: (w) => w.read(readPremoveModel),
  fingerprint: (w) => w.read(readModelFingerprint),
});
