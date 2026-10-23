import { afterAll, beforeAll, expect, test } from 'bun:test';
import {
  CAPTURE,
  CAPTURED,
  REPLACEMENT,
} from '@pkgs/chess-board-root-harness-ts/positions';
import { openBrowserExample } from './browser-fixture';
import type { Frame } from './frame-read';
import { frameRead } from './frame-read';
import { observeFrameWork } from './frame-work';
import type { BoardGeometry } from './geometry-read';
import { geometryRead } from './geometry-read';

let browser: Awaited<ReturnType<typeof openBrowserExample>>;
beforeAll(async () => {
  browser = await openBrowserExample();
}, 60_000);
afterAll(() => browser.close());

async function act(script: string) {
  await browser.view.evaluate(
    `(() => { ${script}; return window.boardExample.paint(); })()`
  );
}
async function image() {
  await act('document.querySelector("[data-testid=browser-board]").focus()');
  return new Bun.Image(await browser.view.screenshot())
    .png({ compressionLevel: 0 })
    .buffer();
}

test('equivalent parent updates and orientation round trips preserve the raster', async () => {
  await act('window.boardExample.reset({size: 319.5, showCoordinates: false})');
  const original = await image();
  await act('window.boardExample.configure({sound: false})');
  expect((await image()).equals(original)).toBe(true);
  await act('window.boardExample.configure({orientation: "black"})');
  expect((await image()).equals(original)).toBe(false);
  await act('window.boardExample.configure({orientation: "white"})');
  expect((await image()).equals(original)).toBe(true);
});

test('a raster reference uses freshly mounted piece nodes', async () => {
  // regression: chessboard-raster-reference
  await act('window.boardExample.reset({size:320})');
  const reference = await browser.view.evaluate<{
    oldConnected: boolean;
    reused: boolean;
  }>(`(() => {
    const original = document.querySelector('[data-piece-square="d2"]');
    window.boardExample.reset({size:320});
    return {oldConnected:original.isConnected,
      reused:document.querySelector('[data-piece-square="d2"]')===original};
  })()`);
  expect(reference.oldConnected).toBe(false);
  expect(reference.reused).toBe(false);
});

test('real layout, piece centers and pointer targets agree after embedding and zoom', async () => {
  for (const width of [128, 160, 319.5, 640, 1024]) {
    for (const orientation of ['white', 'black']) {
      for (const scale of [0.5, 1, 2]) {
        await act(
          `window.boardExample.reset({size: undefined, interactive: false, orientation: "${orientation}"}); window.boardExample.parent(${width}, ${scale})`
        );
        const actual = await browser.view.evaluate<BoardGeometry>(geometryRead);
        expect(actual.width).toBeCloseTo(width * scale, 4);
        expect(actual.height).toBeCloseTo(actual.width, 4);
        expect(actual.squares).toHaveLength(64);
        expect(actual.misses).toEqual([]);
        for (const piece of actual.pieces) {
          // Browser layout quantizes tracks to 1/64 CSS px. Two edges can differ by one unit.
          expect(
            Math.abs(piece.dx),
            JSON.stringify({ width, orientation, scale, piece })
          ).toBeLessThanOrEqual(scale / 32);
          expect(
            Math.abs(piece.dy),
            JSON.stringify({ width, orientation, scale, piece })
          ).toBeLessThanOrEqual(scale / 32);
          expect(piece.image).toStartWith('url("data:image/svg+xml,');
        }
      }
    }
  }
});

test('a 319.5px board keeps every piece centered in either orientation at half scale', async () => {
  // regression: chessboard-fractional-grid-drift
  for (const orientation of ['white', 'black']) {
    await act(
      `window.boardExample.reset({size: undefined, interactive: false, orientation: "${orientation}"}); window.boardExample.parent(319.5, 0.5)`
    );
    const actual = await browser.view.evaluate<BoardGeometry>(geometryRead);
    for (const piece of actual.pieces) {
      expect(Math.abs(piece.dx)).toBeLessThanOrEqual(1 / 64);
      expect(Math.abs(piece.dy)).toBeLessThanOrEqual(1 / 64);
    }
  }
});

test('capture frames remain coherent and require no DOM work between arrivals', async () => {
  await act(
    `window.boardExample.parent(640); window.boardExample.reset({fen: ${JSON.stringify(CAPTURE)}, size: 320, showCoordinates: false}); window.boardExample.move('e4','d5')`
  );
  let previous: Frame | undefined;
  for (const ms of [0, 37.5, 75, 112.5, 150]) {
    const work = await browser.view.evaluate<number>(
      observeFrameWork(`window.boardExample.freeze(${ms})`)
    );
    expect(work).toBe(0);
    const frame = await browser.view.evaluate<Frame>(frameRead);
    expect(frame.ghosts).toHaveLength(1);
    expect(frame.ghosts[0]?.piece).toBe('bp');
    expect(frame.ghosts[0]?.center).toEqual(frame.target);
    expect(frame.pieces).toBe(31);
    if (ms === 0) expect(frame.attacker).toEqual(frame.source);
    if (ms === 150) expect(frame.attacker).toEqual(frame.target);
    if (previous !== undefined) {
      expect(frame.attacker.x).toBeLessThanOrEqual(previous.attacker.x);
      expect(frame.attacker.y).toBeLessThanOrEqual(previous.attacker.y);
      expect(frame.ghosts[0]?.opacity).toBeLessThanOrEqual(
        previous.ghosts[0]?.opacity ?? 1
      );
    }
    for (const animation of frame.animations)
      for (const keys of animation.keys) {
        expect(
          keys.every((key) => key === 'transform' || key === 'opacity')
        ).toBe(true);
      }
    previous = frame;
  }
  await act('window.boardExample.advance(150)');
  const completed = await image();
  await act(
    `window.boardExample.reset({fen: ${JSON.stringify(CAPTURED)}, size:320, showCoordinates:false, animations:false})`
  );
  expect((await image()).equals(completed)).toBe(true);
});

test('the frame work recorder detects a mutation delivered before the paint callback', async () => {
  // regression: chessboard-frame-work-observation
  await act('window.boardExample.reset({size:320})');
  expect(
    await browser.view.evaluate<number>(
      observeFrameWork(
        `document.querySelector('[data-testid="browser-board"]').setAttribute('data-injected-frame-work','1')`
      )
    )
  ).toBe(1);
});

test('interrupted capture raster equals a fresh authoritative position without flashback', async () => {
  await act(
    `window.boardExample.reset({fen:${JSON.stringify(CAPTURE)}, size:320, showCoordinates:false}); window.boardExample.move('e4','d5'); window.boardExample.freeze(75)`
  );
  await act(
    `window.boardExample.configure({fen:${JSON.stringify(REPLACEMENT)}})`
  );
  const interrupted = await image();
  await act('window.boardExample.advance(1000)');
  expect((await image()).equals(interrupted)).toBe(true);
  await act(
    `window.boardExample.reset({fen:${JSON.stringify(REPLACEMENT)}, size:320, showCoordinates:false, animations:false})`
  );
  expect((await image()).equals(interrupted)).toBe(true);
});

test('a resized capture reaches the resized destination', async () => {
  await act(
    `window.boardExample.reset({fen:${JSON.stringify(CAPTURE)}, size:undefined, showCoordinates:false}); window.boardExample.parent(320); window.boardExample.move('e4','d5'); window.boardExample.freeze(75)`
  );
  await act(
    'window.boardExample.parent(639.5); window.boardExample.freeze(150)'
  );
  const frame = await browser.view.evaluate<Frame>(frameRead);
  expect(frame.attacker).toEqual(frame.target);
});
