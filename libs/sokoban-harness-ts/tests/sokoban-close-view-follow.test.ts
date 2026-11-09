import { expect, test } from 'bun:test';
import { followAxis } from '@libs/sokoban-client-ts/sokoban-board-view';

// regression: sokoban-close-view-slides-every-move
test('the close view stays put while the worker is inside it and recentres near an edge', () => {
  // A 6-square window on a 20-square row, first placed around square 7.
  const first = followAxis(undefined, 6, 20, 7);
  expect(first).toBe(4);
  // Steps that keep the worker a square from either edge leave it alone.
  expect(followAxis(first, 6, 20, 6)).toBe(4);
  expect(followAxis(first, 6, 20, 8)).toBe(4);
  // Nearing an edge recentres on the worker.
  expect(followAxis(first, 6, 20, 9)).toBe(6);
  expect(followAxis(first, 6, 20, 4)).toBe(1);
  // At the board's own edge it never moves past it.
  expect(followAxis(0, 6, 20, 0)).toBe(0);
  expect(followAxis(14, 6, 20, 19)).toBe(14);
});
