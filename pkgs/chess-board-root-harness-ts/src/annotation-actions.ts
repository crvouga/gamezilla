import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import type { BoardWorld } from './board-world';

export const ACTIVITY_ARROWS = [
  {
    from: 'e2' as const,
    to: 'e4' as const,
    color: 'green',
    id: 'activity-green',
  },
  {
    from: 'a1' as const,
    to: 'a8' as const,
    color: 'blue',
    dashed: true,
    id: 'activity-blue',
  },
];
export const ACTIVITY_SQUARES = {
  cellHighlights: { d5: { color: 'blue' }, e4: { color: 'gold', ring: true } },
  cellFeedback: { f3: { kind: 'dot' as const, label: 'Plan' } },
};
export const supplyActivityArrows = defineAction({
  name: 'supplyActivityArrows',
  act: (w: BoardWorld, show = true) =>
    w.app.configure({ arrows: show ? ACTIVITY_ARROWS : [] }),
});
export const supplyActivitySquares = defineAction({
  name: 'supplyActivitySquares',
  act: (w: BoardWorld, show = true) =>
    w.app.configure(
      show ? ACTIVITY_SQUARES : { cellHighlights: {}, cellFeedback: {} }
    ),
});
export const clearActivityAnnotations = defineAction({
  name: 'clearActivityAnnotations',
  act: (w: BoardWorld) =>
    w.app.configure({ arrows: [], cellHighlights: {}, cellFeedback: {} }),
});
export function startArrow(w: BoardWorld, from: Square, to: Square) {
  w.app.pointer('pointerdown', from, 'mouse', 2);
  w.app.pointer('pointermove', to, 'mouse', 2);
}
export function drawArrow(w: BoardWorld, from: Square, to: Square) {
  startArrow(w, from, to);
  w.app.pointer('pointerup', to, 'mouse', 2);
}
export const beginPersonalArrow = defineAction({
  name: 'beginPersonalArrow',
  act: startArrow,
});
export const drawPersonalArrow = defineAction({
  name: 'drawPersonalArrow',
  act: drawArrow,
});
export const finishPersonalArrow = defineAction({
  name: 'finishPersonalArrow',
  act(w: BoardWorld) {
    const token = w.app
      .layer('arrows')
      .find((t) => t.startsWith('arrow-preview'));
    const end = token?.split('-').at(-1) as Square | undefined;
    w.app.pointer('pointerup', end ?? 'e4', 'mouse', 2);
  },
});
export const cancelPersonalArrow = defineAction({
  name: 'cancelPersonalArrow',
  act: (w: BoardWorld) => w.app.pointer('pointercancel', 'e4', 'mouse', 2),
});
export const togglePersonalCircle = defineAction({
  name: 'togglePersonalCircle',
  act(w: BoardWorld, square: Square) {
    w.app.pointer('pointerdown', square, 'mouse', 2);
    w.app.pointer('pointerup', square, 'mouse', 2);
  },
});
export const annotationActions = [
  supplyActivityArrows,
  supplyActivitySquares,
  clearActivityAnnotations,
  beginPersonalArrow,
  drawPersonalArrow,
  finishPersonalArrow,
  cancelPersonalArrow,
  togglePersonalCircle,
];
