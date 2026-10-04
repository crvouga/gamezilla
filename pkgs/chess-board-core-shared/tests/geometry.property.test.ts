import { expect, test } from 'bun:test';
import {
  squareCenter,
  squareFromIndex,
  squareToXY,
  xyToSquare,
} from '@pkgs/chess-board-core-shared/geometry';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

const sizes = fc.double({
  min: 8,
  max: 16384,
  noNaN: true,
  noDefaultInfinity: true,
});
const orientation = fc.constantFrom('white' as const, 'black' as const);
test('fractional squares tile their board and every interior point has the same inverse', () => {
  assertProperty(
    'continuous-board-geometry',
    fc.property(
      sizes,
      fc.integer({ min: 0, max: 63 }),
      orientation,
      fc.tuple(
        fc.double({ min: 0.0001, max: 0.9999, noNaN: true }),
        fc.double({ min: 0.0001, max: 0.9999, noNaN: true })
      ),
      (size, index, facing, [fx, fy]) => {
        const square = squareFromIndex(index);
        const box = squareToXY(square, size, facing);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.cell).toBeLessThanOrEqual(size + 1e-9);
        expect(box.y + box.cell).toBeLessThanOrEqual(size + 1e-9);
        expect(
          xyToSquare(box.x + box.cell * fx, box.y + box.cell * fy, size, facing)
        ).toBe(square);
        const opposite = squareToXY(
          square,
          size,
          facing === 'white' ? 'black' : 'white'
        );
        expect(box.x + opposite.x + box.cell).toBeCloseTo(size, 8);
        expect(box.y + opposite.y + box.cell).toBeCloseTo(size, 8);
        const center = squareCenter(square, size, facing);
        expect(center.x).toBe(box.x + box.cell / 2);
        expect(center.y).toBe(box.y + box.cell / 2);
        expect(64 * box.cell * box.cell).toBeCloseTo(size * size, 4);
      }
    )
  );
});
test('resizing through arbitrary positive dimensions preserves logical destinations', () => {
  assertProperty(
    'resize-inverse',
    fc.property(
      fc.array(sizes, { minLength: 1, maxLength: 40 }),
      fc.integer({ min: 0, max: 63 }),
      orientation,
      (sequence, index, facing) => {
        const square = squareFromIndex(index);
        for (const size of sequence) {
          const point = squareCenter(square, size, facing);
          expect(xyToSquare(point.x, point.y, size, facing)).toBe(square);
        }
      }
    )
  );
});
test('invalid geometry cannot create a square', () => {
  // regression: chessboard-nonfinite-hit
  expect(xyToSquare(NaN, 20, 320, 'white')).toBeNull();
  expect(xyToSquare(20, 20, Infinity, 'black')).toBeNull();
});
