import { expect, test } from 'bun:test';
import {
  squareCenter,
  squareFromIndex,
} from '@pkgs/chess-board-core-shared-ts/geometry';
import { normalizeBoardSize } from '@pkgs/chess-board-root-client-ts/chess-board-controller';
import {
  measureBoardBox,
  squareAt,
} from '@pkgs/chess-board-root-shared-ts/board-box';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const side = fc.double({
  min: 8,
  max: 16384,
  noNaN: true,
  noDefaultInfinity: true,
});
const scale = fc.double({
  min: 0.125,
  max: 8,
  noNaN: true,
  noDefaultInfinity: true,
});
test('rendered border and hit targets agree under fractional uniform scaling', () => {
  assertProperty(
    'scaled-board-box',
    fc.property(
      side,
      scale,
      fc.integer({ min: 0, max: 63 }),
      fc.constantFrom('white' as const, 'black' as const),
      (width, zoom, index, orientation) => {
        const node = document.createElement('div');
        Object.defineProperties(node, {
          clientLeft: { value: 2 },
          clientTop: { value: 2 },
          clientWidth: { value: Math.round(width - 4) },
          offsetWidth: { value: Math.round(width) },
        });
        node.getBoundingClientRect = () =>
          new DOMRect(19, 37, width * zoom, width * zoom);
        const box = measureBoardBox(node, width);
        expect(box.left).toBeCloseTo(19 + 2 * zoom, 6);
        expect(box.size).toBeCloseTo((width - 4) * zoom, 6);
        const square = squareFromIndex(index);
        expect(
          squareAt(
            box,
            squareCenter(square, box.size, orientation),
            orientation
          )
        ).toBe(square);
      }
    )
  );
});
test('invalid pointer coordinates never manufacture a square', () => {
  // regression: chessboard-nonfinite-hit
  expect(
    squareAt({ left: 0, top: 0, size: 320 }, { x: NaN, y: 20 }, 'white')
  ).toBeNull();
  expect(
    squareAt({ left: 0, top: 0, size: Infinity }, { x: 20, y: 20 }, 'black')
  ).toBeNull();
});
test('scaled border regression maps the rendered far file', () => {
  // regression: chessboard-scaled-hit
  const node = document.createElement('div');
  Object.defineProperties(node, {
    clientLeft: { value: 2 },
    clientTop: { value: 2 },
    clientWidth: { value: 316 },
    offsetWidth: { value: 320 },
  });
  node.getBoundingClientRect = () => new DOMRect(0, 0, 640, 640);
  expect(measureBoardBox(node, 320)).toEqual({ left: 4, top: 4, size: 632 });
});

test('available fractional dimensions are preserved without rounding cells', () => {
  // regression: chessboard-fill-size-rounding
  expect(normalizeBoardSize(319.5)).toBe(319.5);
  assertProperty(
    'available-board-size',
    fc.property(side, (size) => expect(normalizeBoardSize(size)).toBe(size))
  );
});
