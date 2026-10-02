import { afterAll, beforeAll, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/property';
import { openBrowserExample } from './browser-fixture';
import { type BoardGeometry, geometryRead } from './geometry-read';

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
      async (widths, orientation, scale) => {
        await browser.view.evaluate(
          `window.boardExample.reset({size:undefined, interactive:false, orientation:"${orientation}"})`
        );
        for (const width of widths) {
          await browser.view.evaluate(
            `(() => {window.boardExample.parent(${width},${scale}); return window.boardExample.paint();})()`
          );
          assertGeometry(
            await browser.view.evaluate<BoardGeometry>(geometryRead),
            width,
            scale
          );
        }
      }
    )
  );
}, 60_000);
