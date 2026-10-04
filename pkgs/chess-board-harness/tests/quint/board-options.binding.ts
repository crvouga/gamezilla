import type { BoardWorld } from '@pkgs/chess-board-harness/board-world';
import {
  configureBoard,
  movePiece,
  replacePosition,
  selectSquare,
  setupBoard,
} from '@pkgs/chess-board-harness/chess-board';
import { readModelFingerprint } from '@pkgs/chess-board-harness/model-evidence';
import {
  beginPreparedDrag,
  GREEN_CREAM,
  setAvailableWidth,
  setFixedWidth,
} from '@pkgs/chess-board-harness/options-actions';
import { readOptionsModel } from '@pkgs/chess-board-harness/options-model';
import { PREPARED_OPTIONS } from '@pkgs/chess-board-harness/prepared-positions';
import type { Run } from '@pkgs/harness-shared/run-types';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

bindQuintModel<Run<BoardWorld>>({
  model: 'board-options',
  traces: 100,
  maxSteps: 30,
  verifySteps: 4,
  actions: {
    init: (w) => w.apply(setupBoard, { size: undefined, animations: false }),
    selectOptionsPiece: (w) => w.apply(selectSquare, 'e2'),
    beginOptionsDrag: (w) => w.apply(beginPreparedDrag, 'e2'),
    moveOptionsPiece: (w) => w.apply(movePiece, 'e2', 'e4'),
    requestOptionsPromotion: (w) => w.apply(movePiece, 'a7', 'a8'),
    resizeAvailableSpace: (w, p) =>
      w.apply(setAvailableWidth, p['available'] === 'broad' ? 320 : 195),
    configureFixedWidth: (w, p) =>
      w.apply(
        setFixedWidth,
        p['fixed'] ? (p['chosen'] === 'broad' ? 512 : 195) : undefined
      ),
    configureOptionsInput: (w, p) =>
      w.apply(configureBoard, { interactive: p['canMove'] as boolean }),
    configureCoordinates: (w, p) =>
      w.apply(configureBoard, { showCoordinates: p['show'] as boolean }),
    configureLegalMarks: (w, p) =>
      w.apply(configureBoard, { highlightLegalMoves: p['show'] as boolean }),
    configureLastMoveMarks: (w, p) =>
      w.apply(configureBoard, { highlightLastMove: p['show'] as boolean }),
    configureBoardColors: (w, p) =>
      w.apply(configureBoard, {
        theme:
          p['colors'] === 'green and cream'
            ? GREEN_CREAM
            : { darkSquare: '#b58863', lightSquare: '#f0d9b5' },
      }),
    replaceOptionsPosition: (w, p) =>
      w.apply(
        replacePosition,
        PREPARED_OPTIONS[p['target'] as keyof typeof PREPARED_OPTIONS]
      ),
  },
  observe: (w) => w.read(readOptionsModel),
  fingerprint: (w) => w.read(readModelFingerprint),
});
