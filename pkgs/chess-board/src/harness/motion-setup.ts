import type { Square } from '@pkgs/chess-board-core/types';
import { defineAction } from '@pkgs/harness';
import { Chess } from 'chess.js';
import type { BoardWorld } from './board-world';
import { INITIAL } from './positions';
export const RAPID_CAPTURE_LINE: readonly (readonly [Square, Square])[] = [
  ['e2', 'e4'],
  ['d7', 'd5'],
  ['e4', 'd5'],
  ['d8', 'd5'],
  ['b1', 'c3'],
  ['d5', 'a5'],
];
const oracle = new Chess(INITIAL);
for (const [from, to] of RAPID_CAPTURE_LINE) oracle.move({ from, to });
export const RAPID_CAPTURE_FINAL = {
  fen: oracle.fen(),
  pieces: oracle
    .board()
    .flatMap((rank) =>
      rank.flatMap((piece) =>
        piece === null ? [] : [piece.color + piece.type + '@' + piece.square]
      )
    )
    .sort(),
};
export const prepareRapidCapture = defineAction({
  name: 'prepareRapidCapture',
  act(w: BoardWorld) {
    w.app.reset({ fen: INITIAL });
    w.app.clearEvidence();
    for (const [from, to] of RAPID_CAPTURE_LINE.slice(0, 5)) {
      w.app.tap(from);
      w.app.tap(to);
    }
  },
});
export const readSettledMotion = (w: BoardWorld) =>
  w.app.motion.active() === 0 && !w.app.view().ghost
    ? { fen: w.app.probe().fen, pieces: w.app.view().pieces }
    : null;
