import { Chess } from 'chess.js';
import { PREMOVE_READY } from './premove-actions';

type PreparedPremove = {
  replies: number;
  movedPieces: readonly string[];
  pawnCaptured: boolean;
};
const prepared = new Map<string, PreparedPremove>();
function record(moves: readonly string[]) {
  const chess = new Chess(PREMOVE_READY);
  let replies = 0;
  let pawnCaptured = false;
  const movedPieces: string[] = [];
  for (const move of moves) {
    const result = chess.move({ from: move.slice(0, 2), to: move.slice(2) });
    if (result.color === 'b') replies += 1;
    else movedPieces.push(result.from + ' to ' + result.to);
    if (result.captured === 'p') pawnCaptured = true;
  }
  prepared.set(chess.fen(), { replies, movedPieces, pawnCaptured });
}
record([]);
record(['e7e5']);
record(['h2d2']);
for (const first of ['d2d4', 'g1f3']) {
  record(['e7e5', first]);
  record(['e7e5', first, 'g8f6']);
  record(['e7e5', first, 'g8f6', first === 'd2d4' ? 'g1f3' : 'd2d4']);
}
/** Classify only complete canonical positions from the declared fixtures. */
export function identifyPreparedPremove(fen: string): PreparedPremove {
  const position = prepared.get(fen);
  if (position === undefined)
    throw new Error('Unprepared premove position: ' + fen);
  return position;
}
