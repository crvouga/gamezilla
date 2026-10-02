import { Chess } from 'chess.js';
import type { BoardWorld } from './board-world';
import { CAPTURE, CAPTURED, INITIAL, REPLACEMENT } from './positions';
import { afterPreparedMove } from './prepared-positions';

const POSITIONS = [
  new Chess(CAPTURE).fen(),
  CAPTURED,
  REPLACEMENT,
  afterPreparedMove(CAPTURED, 'g8', 'f6'),
  INITIAL,
];
const PAINTED_POSITIONS = POSITIONS.map((fen) =>
  new Chess(fen)
    .board()
    .flatMap((rank) =>
      rank.flatMap((piece) =>
        piece === null ? [] : [piece.color + piece.type + '@' + piece.square]
      )
    )
    .sort()
);
export function lifecyclePosition(index: number) {
  const fen = POSITIONS[index];
  if (fen === undefined)
    throw new Error('Unknown lifecycle position: ' + String(index));
  return fen;
}
function readClosedBoard() {
  return {
    present: false,
    position: -1,
    displayedPosition: -1,
    selected: false,
    dragging: false,
    interactive: false,
    soundEnabled: false,
    reducedMotion: false,
    orientation: 'none',
    transition: false,
    captureRemnant: false,
    visible: false,
  };
}
export const readLifecycle = (w: BoardWorld) => {
  const earlier = w.app.motion.hasEarlierCompletion();
  if (w.app.closed()) {
    if (w.app.root.isConnected || document.body.contains(w.app.host))
      throw new Error('A closed chessboard still paints pieces');
    return { board: readClosedBoard(), _earlierCompletion: earlier };
  }
  const probe = w.app.probe();
  const painted = w.app.view();
  return {
    board: {
      present: w.app.root.isConnected,
      position: POSITIONS.indexOf(new Chess(probe.fen).fen()),
      displayedPosition: PAINTED_POSITIONS.findIndex(
        (pieces) => JSON.stringify(pieces) === JSON.stringify(painted.pieces)
      ),
      selected: probe.selected !== null,
      dragging: painted.holding,
      interactive: probe.interactive,
      soundEnabled: w.app.config().sound !== false,
      reducedMotion: w.app.motion.env.prefersReducedMotion(),
      orientation: probe.orientation,
      transition: painted.active > 0,
      captureRemnant: painted.ghost,
      visible: !w.app.motion.env.hidden(),
    },
    _earlierCompletion: earlier,
  };
};
