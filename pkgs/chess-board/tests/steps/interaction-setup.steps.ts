import { expect } from 'bun:test';
import {
  type BoardWorld,
  CHECK_IN_ONE,
  CHECKMATED,
  MATE_IN_ONE,
  MATING_CAPTURE,
  MOVABLE,
  PINNED_KNIGHT,
  type PieceName,
  ROOK_CHECK,
  readPiece,
  STALEMATE_IN_ONE,
  STALEMATED,
  setupBoard,
  setupOfferedWhiteMove,
} from '@pkgs/chess-board/harness';
import type { Square } from '@pkgs/chess-board-core/types';
import { stepsFor } from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';

const { Given } = stepsFor<Run<BoardWorld>>();
Given(
  'Alice has a chessboard with a movable White {word} on {word}',
  async (w, piece: PieceName, source: Square) => {
    await w.apply(setupBoard, { fen: MOVABLE[piece] });
    expect(await w.read(readPiece, source)).toEqual({ side: 'White', piece });
  }
);
Given("Alice has a chessboard after White's move from e2 to e4", (w) =>
  w.apply(setupOfferedWhiteMove)
);
Given(
  'Alice has a chessboard with the White knight on e2 pinned to its king on e1 by the Black rook on e8',
  (w) => w.apply(setupBoard, { fen: PINNED_KNIGHT })
);
Given(
  "Alice has a chessboard with White's king on e1 in check from Black's rook on e8 and White's rook on a2",
  (w) => w.apply(setupBoard, { fen: ROOK_CHECK })
);
Given(
  'Alice has a chessboard ready for White to check Black by moving the rook from a2 to e2',
  (w) => w.apply(setupBoard, { fen: CHECK_IN_ONE })
);
Given(
  'Alice has a chessboard ready for White to checkmate Black by moving the queen from g6 to g7',
  (w) => w.apply(setupBoard, { fen: MATE_IN_ONE })
);
Given(
  'Alice has a chessboard ready for White to checkmate Black by capturing the rook on g7 with the queen on g6',
  (w) => w.apply(setupBoard, { fen: MATING_CAPTURE })
);
Given(
  'Alice has a silent chessboard ready for White to checkmate Black by moving the queen from g6 to g7',
  (w) => w.apply(setupBoard, { fen: MATE_IN_ONE, sound: false })
);
Given(
  'Alice has a chessboard ready for White to stalemate Black by moving the queen from f5 to g6',
  (w) => w.apply(setupBoard, { fen: STALEMATE_IN_ONE })
);
Given(
  'Alice has a silent chessboard ready for White to stalemate Black by moving the queen from f5 to g6',
  (w) => w.apply(setupBoard, { fen: STALEMATE_IN_ONE, sound: false })
);
Given('Alice has a chessboard with Black checkmated', (w) =>
  w.apply(setupBoard, { fen: CHECKMATED })
);
Given('Alice has a chessboard with Black stalemated', (w) =>
  w.apply(setupBoard, { fen: STALEMATED })
);
