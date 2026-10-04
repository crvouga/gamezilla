import { afterAll, beforeAll, expect, test } from 'bun:test';
import { CAPTURE } from '@pkgs/chess-board-root-harness/positions';
import { BOARD_PERF_BUDGETS } from '@pkgs/chess-board-root-shared/chess-board-bench';
import { Chess } from 'chess.js';
import { openBrowserExample } from './browser-fixture';

let browser: Awaited<ReturnType<typeof openBrowserExample>>;
beforeAll(async () => {
  browser = await openBrowserExample();
}, 60_000);
afterAll(() => browser.close());

type InputTiming = {
  readonly scripting: number;
  readonly painted: number;
  readonly pieces: number;
  readonly fen: string;
};

test('the public benchmark can scrub 200 plies and mount twenty boards without emitting audio', async () => {
  // regression: chessboard-benchmark-sound
  const sounds = await browser.view.evaluate<readonly string[]>(`(async () => {
    const api=window.boardExample;
    api.benchmark();
    await api.paint();
    [...document.querySelectorAll('button')].find(el=>el.textContent==='Scrub 200 plies').click();
    api.advance(0);
    [...document.querySelectorAll('button')].find(el=>el.textContent==='Mount 20 boards').click();
    await api.paint();
    return api.sounds();
  })()`);
  expect(sounds).toEqual([]);
});

test('capture input and its first visible response meet the existing 50ms budget', async () => {
  const expected = new Chess(CAPTURE);
  expected.move({ from: 'e4', to: 'd5' });
  const samples = await browser.view.evaluate<
    readonly InputTiming[]
  >(`(async () => {
    const api = window.boardExample;
    const samples = [];
    for (const width of [196,319.5,640]) for (const orientation of ['white','black']) {
      api.reset({fen:${JSON.stringify(CAPTURE)},size:width,orientation,showCoordinates:false});
      await api.paint();
      const start = api.now();
      api.move('e4','d5');
      const scripting = api.now()-start;
      await api.paint();
      await api.paint();
      const board = document.querySelector('[data-testid="browser-board"]');
      const probe = JSON.parse(document.querySelector('[data-testid="browser-board-probe"]').textContent);
      samples.push({scripting,painted:api.now()-start,
        pieces:board.querySelectorAll('[data-piece-square]').length,fen:probe.fen});
    }
    return samples;
  })()`);
  for (const sample of samples) {
    expect(sample.fen).toBe(expected.fen());
    expect(sample.pieces).toBe(31);
    expect(sample.scripting, JSON.stringify(sample)).toBeLessThan(
      BOARD_PERF_BUDGETS.longTaskMs
    );
    expect(sample.painted, JSON.stringify(sample)).toBeLessThan(
      BOARD_PERF_BUDGETS.inpMs
    );
  }
});

test('sustained legal positions, flips and resizes keep each work slice below 50ms', async () => {
  const game = new Chess();
  const positions = [game.fen()];
  for (const san of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3', 'Bc5']) {
    game.move(san);
    positions.push(game.fen());
  }
  const slices = await browser.view.evaluate<readonly number[]>(`(async () => {
    const api = window.boardExample;
    api.reset({size:undefined,interactive:false,showCoordinates:false});
    api.parent(640);
    await api.paint();
    const positions = ${JSON.stringify(positions)};
    const slices = [];
    for (let cycle=0;cycle<24;cycle++) for (const fen of positions) {
      const start = api.now();
      api.configure({fen,orientation:cycle%2 ? 'black':'white'});
      api.parent(319.5+(cycle%3)*160.25);
      // Force exactly one layout after each complete update, not per piece.
      document.querySelector('[data-testid="browser-board"]').getBoundingClientRect();
      slices.push(api.now()-start);
      await api.paint();
    }
    return slices;
  })()`);
  expect(slices).toHaveLength(216);
  expect(Math.max(...slices)).toBeLessThan(BOARD_PERF_BUDGETS.longTaskMs);
});

test('live capture frames progress monotonically without a 50ms frame gap', async () => {
  const frames = await browser.view.evaluate<
    readonly {
      gap: number;
      distance: number;
      pieces: number;
    }[]
  >(`(async () => {
    const api=window.boardExample;
    api.reset({fen:${JSON.stringify(CAPTURE)},size:319.5,showCoordinates:false});
    api.move('e4','d5');
    api.play();
    const center=el=>{const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};};
    const target=center(document.querySelector('[data-square="d5"]'));
    const frames=[];
    let previous=api.now();
    for (let i=0;i<14;i++) {
      await api.paint();
      const now=api.now();
      const attacker=center(document.querySelector('[data-piece-square="d5"]'));
      frames.push({gap:now-previous,distance:Math.hypot(attacker.x-target.x,attacker.y-target.y),
        pieces:document.querySelectorAll('[data-piece-square]').length});
      previous=now;
    }
    api.advance(150);
    return frames;
  })()`);
  expect(frames).toHaveLength(14);
  expect(frames[0]?.distance).toBeGreaterThan(0);
  expect(frames.at(-1)?.distance).toBeLessThanOrEqual(1 / 32);
  for (const [index, frame] of frames.entries()) {
    expect(frame.pieces).toBe(31);
    expect(frame.gap).toBeLessThan(BOARD_PERF_BUDGETS.longTaskMs);
    if (index > 0)
      expect(frame.distance).toBeLessThanOrEqual(
        (frames[index - 1]?.distance ?? 0) + 1 / 32
      );
  }
});
