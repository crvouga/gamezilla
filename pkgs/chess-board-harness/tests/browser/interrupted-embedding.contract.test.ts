import { afterAll, beforeAll, expect, test } from 'bun:test';
import { CAPTURE, REPLACEMENT } from '@pkgs/chess-board-harness/positions';
import { Chess } from 'chess.js';
import { openBrowserExample } from './browser-fixture';

let browser: Awaited<ReturnType<typeof openBrowserExample>>;
beforeAll(async () => {
  browser = await openBrowserExample();
}, 60_000);
afterAll(() => browser.close());

async function act(script: string) {
  await browser.view.evaluate(
    `(() => {${script}; return window.boardExample.paint();})()`
  );
}
async function raster() {
  await act('document.querySelector("[data-testid=browser-board]").focus()');
  return new Bun.Image(await browser.view.screenshot())
    .png({ compressionLevel: 0 })
    .buffer();
}
const reply = new Chess(CAPTURE);
reply.move({ from: 'e4', to: 'd5' });
reply.move({ from: 'g8', to: 'f6' });

test.each([reply.fen(), REPLACEMENT])(
  'a resized and turned capture yields to the newest position %s',
  async (fen) => {
    const canonical = new Chess(fen)
      .board()
      .flatMap((rank) =>
        rank.flatMap((piece) =>
          piece === null ? [] : [piece.color + piece.type + '@' + piece.square]
        )
      )
      .toSorted();
    for (const turn of [false, true]) {
      const orientation = turn ? 'black' : 'white';
      await act(
        `window.boardExample.reset({fen:${JSON.stringify(CAPTURE)},size:undefined,showCoordinates:false,highlightLastMove:false}); window.boardExample.parent(320); window.boardExample.move('e4','d5'); window.boardExample.freeze(75)`
      );
      expect(
        await browser.view.evaluate<number>('document.getAnimations().length')
      ).toBeGreaterThan(0);
      await act(
        `window.boardExample.parent(639.5); window.boardExample.configure({orientation:"${orientation}"}); window.boardExample.configure({fen:${JSON.stringify(fen)}}); window.boardExample.advance(1000)`
      );
      await browser.view.evaluate(`(async () => {
        const animations = document.getAnimations();
        for (const animation of animations) animation.finish();
        await Promise.all(animations.map(animation => animation.finished));
        await window.boardExample.paint();
      })()`);
      const actual = await browser.view.evaluate<{
        fen: string;
        pieces: string[];
        ghosts: number;
        animations: number;
      }>(`(() => {
      const board=document.querySelector('[data-testid="browser-board"]');
      const probe=JSON.parse(document.querySelector('[data-testid="browser-board-probe"]').textContent);
      return {fen:probe.fen,pieces:[...board.querySelectorAll('[data-piece-square]')].map(el=>el.dataset.piece+'@'+el.dataset.pieceSquare).sort(),
        ghosts:board.querySelectorAll('[data-piece]:not([data-piece-square])').length,animations:document.getAnimations().length};
    })()`);
      expect(actual.fen).toBe(fen);
      expect(actual.pieces).toEqual(canonical);
      expect(actual.ghosts).toBe(0);
      expect(actual.animations).toBe(0);
      const final = await raster();
      await act('window.boardExample.advance(1000)');
      expect((await raster()).equals(final)).toBe(true);
      await act(
        `window.boardExample.reset({fen:${JSON.stringify(fen)},size:undefined,orientation:"${orientation}",showCoordinates:false,highlightLastMove:false,animations:false}); window.boardExample.parent(639.5)`
      );
      expect((await raster()).equals(final)).toBe(true);
    }
  }
);
