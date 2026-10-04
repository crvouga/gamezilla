import { defineAction } from '@pkgs/harness-shared/define-action';
import { Chess } from 'chess.js';
import type { BoardWorld } from './board-world';
import { MATE_IN_ONE } from './interaction-fixtures';
import { INITIAL } from './positions';

const EXPECTED_OPENING_PIECES = new Chess(INITIAL)
  .board()
  .flatMap((row) =>
    row.flatMap((piece) =>
      piece === null ? [] : [piece.color + piece.type + '@' + piece.square]
    )
  )
  .sort();
export const OPENING_BOARD = {
  fen: INITIAL,
  size: 320,
  status: 'playing' as const,
  inCheck: false,
  interactive: true,
  promotion: null,
  premoves: [],
  turn: 'w' as const,
  pieces: EXPECTED_OPENING_PIECES,
  selected: null,
  legalTargets: [],
  lastMove: null,
  squares: [],
  arrows: [],
  shapes: [],
  feedback: [],
};
export const readOpeningBoard = (w: BoardWorld) => {
  const p = w.app.probe();
  return {
    fen: p.fen,
    size: p.size,
    status: p.status,
    inCheck: p.inCheck,
    interactive: p.interactive,
    promotion: p.promotion,
    premoves: p.premoves,
    turn: p.turn,
    pieces: w.app.view().pieces,
    selected: p.selected,
    legalTargets: p.legalTargets,
    lastMove: p.lastMove,
    squares: w.app.layer('squares'),
    arrows: w.app.layer('arrows'),
    shapes: w.app.layer('shapes'),
    feedback: w.app.layer('feedback'),
  };
};
export const focusOtherActivityControl = defineAction({
  name: 'focusOtherActivityControl',
  act(w: BoardWorld) {
    const control = document.createElement('button');
    control.textContent = 'Other activity';
    document.body.append(control);
    control.focus();
    w.otherActivityControl = control;
    w.session.onDispose(() => control.remove());
  },
});
export const readOtherActivityFocus = (w: BoardWorld) => ({
  present: w.otherActivityControl?.isConnected ?? false,
  focused: document.activeElement === w.otherActivityControl,
});
export const prepareClosedOptimisticBoard = defineAction({
  name: 'prepareClosedOptimisticBoard',
  act(w: BoardWorld) {
    w.app.reset({});
    w.app.tap('e2');
    w.app.tap('e4');
    w.app.tap('e7');
    if (w.app.probe().selected !== 'e7')
      throw new Error('Reply pawn was not selected');
    w.app.close();
  },
});
export const prepareArrivingMate = defineAction({
  name: 'prepareArrivingMate',
  act(w: BoardWorld) {
    w.app.reset({ fen: MATE_IN_ONE });
    w.app.tap('g6');
    w.app.tap('g7');
  },
});
export const openingActions = [
  focusOtherActivityControl,
  prepareClosedOptimisticBoard,
  prepareArrivingMate,
];
