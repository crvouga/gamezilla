import type { Square } from '@pkgs/chess-board-core-shared/types';
import { defineAction } from '@pkgs/harness-root-shared/define-action';
import type { BoardWorld } from './board-world';

export const GREEN_CREAM = { darkSquare: 'green', lightSquare: '#f0d9b5' };
export const setAvailableWidth = defineAction({
  name: 'setAvailableWidth',
  act: (w: BoardWorld, width: number) => w.app.setAvailableWidth(width),
});
export const setFixedWidth = defineAction({
  name: 'setFixedWidth',
  act: (w: BoardWorld, width?: number) => w.app.configure({ size: width }),
});
export const pressBoardKey = defineAction({
  name: 'pressBoardKey',
  act: sendBoardKey,
});
export const beginPreparedDrag = defineAction({
  name: 'beginPreparedDrag',
  act(w: BoardWorld, source: Square) {
    w.app.pointer('pointerdown', source);
    if (!w.app.view().holding) w.app.pointer('pointerup', source);
  },
});
export const clearBoardEvidence = defineAction({
  name: 'clearBoardEvidence',
  act: (w: BoardWorld) => w.app.clearEvidence(),
});
export const optionsActions = [
  setAvailableWidth,
  setFixedWidth,
  pressBoardKey,
  beginPreparedDrag,
  clearBoardEvidence,
];

export function sendBoardKey(w: BoardWorld, key: string) {
  const active = document.activeElement;
  const target =
    active instanceof HTMLElement && w.app.host.contains(active)
      ? active
      : w.app.host.querySelector<HTMLElement>('[data-square]');
  if (target === null) throw new Error('No keyboard destination on board');
  target.focus();
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }));
}
