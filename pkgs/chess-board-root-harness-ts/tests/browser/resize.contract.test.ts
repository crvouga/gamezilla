import { afterAll, beforeAll, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { openBrowserExample } from './browser-fixture';
import type { BoardGeometry } from './geometry-read';
import { geometryRead } from './geometry-read';

let browser: Awaited<ReturnType<typeof openBrowserExample>>;
beforeAll(async () => {
  browser = await openBrowserExample();
}, 60_000);
afterAll(() => browser.close());

function assertGeometry(actual: BoardGeometry, width: number, scale: number) {
  expect(Math.abs(actual.width - width * scale)).toBeLessThanOrEqual(
    scale / 32
  );
  expect(Math.abs(actual.height - actual.width)).toBeLessThanOrEqual(
    scale / 32
  );
  expect(actual.squares).toHaveLength(64);
  expect(new Set(actual.squares.map((s) => s.square)).size).toBe(64);
  expect(actual.misses).toEqual([]);
  for (const piece of actual.pieces) {
    expect(Math.abs(piece.dx)).toBeLessThanOrEqual(scale / 32);
    expect(Math.abs(piece.dy)).toBeLessThanOrEqual(scale / 32);
  }
  const ordered = [...actual.squares].sort((a, b) => a.y - b.y || a.x - b.x);
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 8; col++) {
      const square = ordered[row * 8 + col];
      const first = ordered[0];
      if (square === undefined || first === undefined)
        throw new Error('Missing square');
      // Layout and transformed DOMRect edges are quantized independently.
      // Bound both at 1/64px, comparing adjacent edges without accumulated error.
      const previousColumn = ordered[row * 8 + col - 1];
      const previousRow = ordered[(row - 1) * 8 + col];
      if (col > 0 && previousColumn !== undefined)
        expect(
          Math.abs(square.x - previousColumn.x - previousColumn.width),
          JSON.stringify({ square, previousColumn, width, scale })
        ).toBeLessThanOrEqual(scale / 32);
      if (row > 0 && previousRow !== undefined)
        expect(
          Math.abs(square.y - previousRow.y - previousRow.height)
        ).toBeLessThanOrEqual(scale / 32);
      expect(Math.abs(square.width - first.width)).toBeLessThanOrEqual(
        scale / 32
      );
      expect(Math.abs(square.height - first.height)).toBeLessThanOrEqual(
        scale / 32
      );
    }
}

test('fractional square edges remain adjacent at a 128.49999237060547px width and twice scale', async () => {
  // regression: chessboard-fractional-cell-step
  await browser.view.evaluate(
    `(() => { window.boardExample.reset({size:undefined,interactive:false}); window.boardExample.parent(128.49999237060547,2); return window.boardExample.paint(); })()`
  );
  assertGeometry(
    await browser.view.evaluate<BoardGeometry>(geometryRead),
    128.49999237060547,
    2
  );
});

async function checkResizes(
  widths: readonly number[],
  orientation: string,
  scale: number
) {
  const frames = await browser.view.evaluate<
    { width: number; geometry: BoardGeometry }[]
  >(`(async () => {
    const api = window.boardExample;
    api.reset({size:undefined, interactive:false, orientation:${JSON.stringify(orientation)}});
    const frames = [];
    for (const width of ${JSON.stringify(widths)}) {
      api.parent(width, ${scale});
      await api.paint();
      frames.push({width, geometry: ${geometryRead}});
    }
    return frames;
  })()`);
  expect(frames.map((frame) => frame.width)).toEqual([...widths]);
  for (const { width, geometry } of frames)
    assertGeometry(geometry, width, scale);
}

test.each([0.5, 2])(
  'an eight-pixel board maps every square after repeated resizes at %s scale',
  async (scale) => {
    // regression: chessboard-tiny-scaled-square-hit
    // regression: chessboard-resize-before-observer
    await checkResizes([8, 8, 8], 'white', scale);
  }
);

test('all centers still take input across the resizes reached at the Nightly deadline', async () => {
  // regression: chessboard-nightly-resize-probe-work
  await checkResizes(
    [9389.106899256356, 2106.8941864828776, 18.895797344418355],
    'black',
    2
  );
});

test('generated fractional resize sequences preserve square tiling, centered pieces and actual input mapping', async () => {
  await assertProperty(
    'browser-fractional-resize',
    fc.asyncProperty(
      fc.array(
        fc.double({
          min: 8,
          max: 16384,
          noNaN: true,
          noDefaultInfinity: true,
        }),
        { minLength: 3, maxLength: 6 }
      ),
      fc.constantFrom('white', 'black'),
      fc.constantFrom(0.5, 1, 1.25, 2, 3, 4),
      checkResizes
    )
  );
}, 60_000);
