import { afterAll, beforeAll, expect, test } from 'bun:test';
import { Chess, type Move, SQUARES } from 'chess.js';
import { openBrowserExample } from './browser-fixture';
import { observeFrameWork } from './frame-work';
import {
  type MovingFrame,
  type Point,
  SPECIAL_FRAMES,
  type SpecialFrame,
  specialFrameRead,
} from './special-frame-fixtures';

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
async function raster() {
  await act('document.querySelector("[data-testid=browser-board]").focus()');
  return new Bun.Image(await browser.view.screenshot())
    .png({ compressionLevel: 0 })
    .buffer();
}
function aligned(actual: Point, expected: Point) {
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(1 / 32);
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(1 / 32);
}

function assertMoving(
  piece: MovingFrame,
  time: number,
  before: MovingFrame | undefined
) {
  if (time === 0) aligned(piece.piece, piece.source);
  if (time === 150) aligned(piece.piece, piece.destination);
  for (const axis of ['x', 'y'] as const) {
    expect(piece.piece[axis]).toBeGreaterThanOrEqual(
      Math.min(piece.source[axis], piece.destination[axis]) - 1 / 32
    );
    expect(piece.piece[axis]).toBeLessThanOrEqual(
      Math.max(piece.source[axis], piece.destination[axis]) + 1 / 32
    );
    if (before !== undefined)
      expect(
        Math.abs(piece.piece[axis] - piece.destination[axis])
      ).toBeLessThanOrEqual(
        Math.abs(before.piece[axis] - piece.destination[axis]) + 1 / 32
      );
  }
}

function checkFrame(
  frame: SpecialFrame,
  time: number,
  previous: SpecialFrame | undefined,
  move: Move
) {
  const capture = move.isCapture() || move.isEnPassant();
  expect(frame.ghosts).toHaveLength(capture ? 1 : 0);
  if (capture) {
    const victim = move.isEnPassant()
      ? `${move.to[0]}${move.from[1]}`
      : move.to;
    const ghost = frame.ghosts[0];
    const target = frame.squares[victim];
    if (ghost === undefined || target === undefined)
      throw new Error('Missing captured piece geometry');
    aligned(ghost.center, target);
    expect(ghost.code).toBe(
      `${move.color === 'w' ? 'b' : 'w'}${move.captured}`
    );
    expect(ghost.opacity).toBeGreaterThanOrEqual(0);
    expect(ghost.opacity).toBeLessThanOrEqual(1);
    if (time === 0) expect(ghost.opacity).toBe(1);
    if (time === 150) expect(ghost.opacity).toBe(0);
    if (previous?.ghosts[0] !== undefined)
      expect(ghost.opacity).toBeLessThanOrEqual(previous.ghosts[0].opacity);
  }
  for (const [index, piece] of frame.moving.entries())
    assertMoving(piece, time, previous?.moving[index]);
}

for (const fixture of SPECIAL_FRAMES)
  test(`${fixture.name} paints a coherent native path and independent final raster`, async () => {
    const chess = new Chess(fixture.fen);
    const move = chess.move(fixture);
    const moving = [{ from: fixture.from, to: fixture.to }];
    if (move.isKingsideCastle()) moving.push({ from: 'h1', to: 'f1' });
    if (move.isQueensideCastle()) moving.push({ from: 'a1', to: 'd1' });
    const pieces = SQUARES.flatMap((square) => {
      const piece = chess.get(square);
      return piece === undefined
        ? []
        : [`${piece.color}${piece.type}@${square}`];
    }).sort();
    for (const size of [196, 639.5])
      for (const orientation of ['white', 'black']) {
        await act(
          `window.boardExample.reset({fen:${JSON.stringify(fixture.fen)},size:${size},orientation:"${orientation}",showCoordinates:false}); window.boardExample.move('${fixture.from}','${fixture.to}'); ${fixture.promotion === undefined ? '' : `document.querySelector('[data-testid="browser-board-promotion-q"]').click(); window.boardExample.freeze(0)`}; document.querySelector('[data-testid="browser-board"]').focus()`
        );
        let previous: SpecialFrame | undefined;
        for (const time of [0, 50, 100, 150]) {
          expect(
            await browser.view.evaluate<number>(
              observeFrameWork(`window.boardExample.freeze(${time})`)
            )
          ).toBe(0);
          const frame = await browser.view.evaluate<SpecialFrame>(
            specialFrameRead(moving)
          );
          expect(frame.pieces).toEqual(pieces);
          checkFrame(frame, time, previous, move);
          previous = frame;
        }
        await act('window.boardExample.advance(150)');
        const completed = await raster();
        await act(
          `window.boardExample.reset({fen:${JSON.stringify(chess.fen())},size:${size},orientation:"${orientation}",showCoordinates:false,animations:false})`
        );
        expect((await raster()).equals(completed)).toBe(true);
      }
  }, 60_000);
