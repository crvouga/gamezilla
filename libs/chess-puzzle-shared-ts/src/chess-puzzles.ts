/**
 * What chess supplies for puzzles: a stored record is a chess puzzle when
 * the §23 validation accepts it, a move is spelled in canonical UCI
 * (castling entered as king-onto-rook included, promotion pieces kept),
 * two positions are the same when FEN fields 1–4 agree, and an action
 * names its from- and to-squares.
 */

import { isSamePosition } from '@pkgs/chess-rules-shared-ts/fen';
import { applyUci } from '@pkgs/chess-rules-shared-ts/moves';
import { parseUci } from '@pkgs/chess-rules-shared-ts/uci';
import type {
  PuzzleRecord,
  PuzzlesCapability,
} from '@pkgs/turn-game-shared-ts/game-puzzles';
import { puzzlePositionKey, validatePuzzleFields } from './puzzle-validation';
import { isBoardSquare } from './recommendation-arrows';

function fieldsOf(record: PuzzleRecord) {
  return {
    id: record.id,
    fen: record.position,
    moves: record.line.join(' '),
    rating: record.rating,
    ratingDeviation: record.ratingDeviation,
    popularity: record.popularity,
    plays: record.plays,
    themes: record.themes,
    openingTags: [],
    gameUrl: null,
  };
}

/** Chess's puzzles: the unprefixed namespace every stored puzzle already has. */
export const chessPuzzles: PuzzlesCapability = {
  namespace: '',
  content: {
    validate(record) {
      const verdict = validatePuzzleFields(fieldsOf(record));
      return verdict.ok
        ? { ok: true }
        : { ok: false, reason: verdict.reason, detail: verdict.detail };
    },
    positionKey: (record) =>
      puzzlePositionKey(record.position.split(' '), record.line),
  },
  judge: {
    canonical(position, action) {
      const spelled = action.trim().toLowerCase();
      const played = applyUci(position, spelled);
      return played.ok ? played.uci : spelled;
    },
    samePosition: isSamePosition,
  },
  marks(_position, action) {
    const move = parseUci(action);
    return move === null ? null : { from: move.from, to: move.to };
  },
  isCell: isBoardSquare,
};
