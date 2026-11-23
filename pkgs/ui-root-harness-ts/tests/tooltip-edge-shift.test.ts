import { expect, test } from 'bun:test';
import { tooltipEdgeShift } from '@pkgs/ui-root-client-ts/tooltip';

// regression: tooltip-cut-off-at-screen-edge
// Literal input: "Back to spaces" centred under the back button at the left
// edge of a 390px phone, and "Space menu" under the last button at the right.
test('a bubble crossing the screen’s edge slides back inside it', () => {
  expect(tooltipEdgeShift({ left: -22, right: 82 }, 390)).toBe(30);
  expect(tooltipEdgeShift({ left: 322, right: 410 }, 390)).toBe(-28);
});

test('a bubble that fits stays where its placement put it', () => {
  expect(tooltipEdgeShift({ left: 8, right: 382 }, 390)).toBe(0);
  expect(tooltipEdgeShift({ left: 120, right: 220 }, 390)).toBe(0);
});

test('a bubble wider than the screen keeps its start in view', () => {
  expect(tooltipEdgeShift({ left: 100, right: 500 }, 390)).toBe(-92);
});
