import type { Square } from '@pkgs/chess-board-core-shared/types';
import type { BoardWorld } from './board-world';
import type { PieceName } from './interaction-fixtures';

const PIECE_NAMES: Readonly<Record<string, PieceName>> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};
export const readInteraction = (w: BoardWorld) => {
  const probe = w.app.probe();
  const paint = w.app.layer();
  return {
    selected: probe.selected,
    legalDestinations: probe.legalTargets,
    sideToMove: probe.turn === 'w' ? 'White' : 'Black',
    status: probe.status,
    interactive: probe.interactive,
    lastMove: probe.lastMove,
    lastMoveMarks: paint.filter((mark) => mark.startsWith('last-move@')),
    checkMarks: paint.filter((mark) => mark.startsWith('check@')),
    captureDestinations: paint.filter((mark) => mark.startsWith('ring@')),
    promotion: probe.promotion,
  };
};
export const readPiece = (w: BoardWorld, square: Square) => {
  const piece = w.app
    .view()
    .pieces.find((entry) => entry.endsWith(`@${square}`));
  return piece === undefined
    ? null
    : {
        side: piece.startsWith('w') ? 'White' : 'Black',
        piece: PIECE_NAMES[piece[1] ?? ''],
      };
};
export const readPromotionChoices = (w: BoardWorld) =>
  w.app.promotionChoices().map((kind) => PIECE_NAMES[kind]);
export const readAnnouncement = (w: BoardWorld) => w.app.spoken();
export const readMovePayloads = (w: BoardWorld) => w.app.moveDetails();
export const readActivityMoves = (w: BoardWorld) =>
  w.app.moveDetails().map((move) => ({
    ...move,
    promotion:
      move.promotion === undefined ? null : PIECE_NAMES[move.promotion],
    captured: move.captured === undefined ? null : PIECE_NAMES[move.captured],
    castling:
      (
        { 'O-O': 'kingside', 'O-O-O': 'queenside' } as Readonly<
          Record<string, string>
        >
      )[move.san ?? ''] ?? null,
  }));
/** Read after delayed feedback has had time to finish, including its absence. */
export const readCompletedFeedback = (w: BoardWorld) =>
  w.session.ports.clock.now() < w.app.feedbackReadyAt()
    ? null
    : w.app.audio.played();
