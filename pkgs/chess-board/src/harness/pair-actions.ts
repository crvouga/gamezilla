import type { Square } from '@pkgs/chess-board-core/types';
import { defineAction } from '@pkgs/harness';
import type { BoardWorld } from './board-world';
import { mountPair, observePairInput, type PairSide } from './pair-world';
import { REPLACEMENT } from './positions';

export const preparePair = defineAction({
  name: 'preparePair',
  async act(w: BoardWorld) {
    mountPair(w);
    await w.session.waitForIdle();
  },
});
export const selectSeparatePiece = defineAction({
  name: 'selectSeparatePiece',
  act: (w: BoardWorld, name: PairSide, square: Square = 'e2') =>
    observePairInput(w, name, (app) => app.tap(square)),
});
export const beginSeparateDrag = defineAction({
  name: 'beginSeparateDrag',
  act: (w: BoardWorld, name: PairSide, square: Square = 'e2') =>
    observePairInput(w, name, (app) => app.pointer('pointerdown', square)),
});
export const cancelSeparateDrag = defineAction({
  name: 'cancelSeparateDrag',
  act: (w: BoardWorld, name: PairSide) =>
    observePairInput(w, name, (app) =>
      app.host.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })
      )
    ),
});
export const moveSeparatePiece = defineAction({
  name: 'moveSeparatePiece',
  act: (
    w: BoardWorld,
    name: PairSide,
    from: Square = 'e2',
    to: Square = 'e4'
  ) =>
    observePairInput(w, name, (app) => {
      if (app.probe().selected !== from) app.tap(from);
      app.tap(to);
    }),
});
export const configureSeparateInput = defineAction({
  name: 'configureSeparateInput',
  act: (w: BoardWorld, name: PairSide, interactive: boolean) =>
    observePairInput(w, name, (app) => app.configure({ interactive })),
});
export const configureSeparateSound = defineAction({
  name: 'configureSeparateSound',
  act: (w: BoardWorld, name: PairSide, sound: boolean) =>
    observePairInput(w, name, (app) => app.configure({ sound })),
});
export const replaceSeparatePosition = defineAction({
  name: 'replaceSeparatePosition',
  act: (w: BoardWorld, name: PairSide) =>
    observePairInput(w, name, (app) => app.configure({ fen: REPLACEMENT })),
});
export const closeSeparateBoard = defineAction({
  name: 'closeSeparateBoard',
  act: (w: BoardWorld, name: PairSide) =>
    observePairInput(w, name, (app) => app.close()),
});
export const pairActions = [
  preparePair,
  selectSeparatePiece,
  beginSeparateDrag,
  cancelSeparateDrag,
  moveSeparatePiece,
  configureSeparateInput,
  configureSeparateSound,
  replaceSeparatePosition,
  closeSeparateBoard,
];
