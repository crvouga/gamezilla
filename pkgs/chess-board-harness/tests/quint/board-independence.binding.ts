import type { BoardWorld } from '@pkgs/chess-board-harness/board-world';
import { beginSeparateDrag, cancelSeparateDrag, closeSeparateBoard, configureSeparateInput, configureSeparateSound, moveSeparatePiece, preparePair, replaceSeparatePosition, selectSeparatePiece } from '@pkgs/chess-board-harness/pair-actions';
import type { PairSide } from '@pkgs/chess-board-harness/pair-world';
import { readPairFingerprint, readPairModel } from '@pkgs/chess-board-harness/pair-reads';
import type { Run } from '@pkgs/harness-shared/run-types';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

bindQuintModel<Run<BoardWorld>>({
  model: 'board-independence',
  traces: 100,
  maxSteps: 30,
  verifySteps: 4,
  actions: {
    init: (w) => w.apply(preparePair),
    selectSeparatePiece: (w, p) =>
      w.apply(selectSeparatePiece, p['name'] as PairSide),
    beginSeparateDrag: (w, p) =>
      w.apply(beginSeparateDrag, p['name'] as PairSide),
    cancelSeparateDrag: (w, p) =>
      w.apply(cancelSeparateDrag, p['name'] as PairSide),
    moveSeparatePiece: (w, p) =>
      w.apply(moveSeparatePiece, p['name'] as PairSide),
    configureSeparateInput: (w, p) =>
      w.apply(
        configureSeparateInput,
        p['name'] as PairSide,
        p['canMove'] as boolean
      ),
    configureSeparateSound: (w, p) =>
      w.apply(
        configureSeparateSound,
        p['name'] as PairSide,
        p['sound'] as boolean
      ),
    replaceSeparatePosition: (w, p) =>
      w.apply(replaceSeparatePosition, p['name'] as PairSide),
    closeSeparateBoard: (w, p) =>
      w.apply(closeSeparateBoard, p['name'] as PairSide),
  },
  observe: (w) => w.read(readPairModel),
  fingerprint: (w) => w.read(readPairFingerprint),
});
