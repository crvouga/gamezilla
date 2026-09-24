/**
 * Model-based runs: a seeded random "person" plays whole games through every
 * gesture (drag, click-click, keyboard, promotion picker), mixes in illegal
 * attempts and board flips, and after every step the board must agree with
 * an independent chess.js reference and paint exactly what its model says.
 */

import { describe, expect, test } from 'bun:test';
import type { Square } from '@pkgs/chess-board-core/types';
import type { DriverKey } from '@pkgs/ui-testing';

import type { ChessBoardHost } from '../board-host';
import { type BoardPage, openBoard } from '../board-page';
import {
  ALL_SQUARES,
  allLegalMoves,
  createRng,
  FEN,
  isGameOver,
  legalTargets,
  type OracleMove,
  pieceAt,
  play,
  turnOf,
} from '../oracle';

type Rng = ReturnType<typeof createRng>;

const PLIES = 40;
const SEEDS = [1, 7, 42];

function uciOf(m: OracleMove): string {
  return `${m.from}${m.to}${m.promotion ?? ''}`;
}

/** Screen-space arrow keys that walk the cursor from `from` to `to`. */
function keysBetween(
  from: Square,
  to: Square,
  orientation: 'white' | 'black'
): DriverKey[] {
  const sign = orientation === 'white' ? 1 : -1;
  const df = (to.charCodeAt(0) - from.charCodeAt(0)) * sign;
  const dr = (to.charCodeAt(1) - from.charCodeAt(1)) * sign;
  const keys: DriverKey[] = [];
  for (let i = 0; i < Math.abs(df); i += 1) {
    keys.push(df > 0 ? 'arrowRight' : 'arrowLeft');
  }
  for (let i = 0; i < Math.abs(dr); i += 1) {
    keys.push(dr > 0 ? 'arrowUp' : 'arrowDown');
  }
  return keys;
}

async function keyboardMove(board: BoardPage, m: OracleMove): Promise<void> {
  const probe = await board.probe();
  for (const key of keysBetween(probe.cursor, m.from, probe.orientation)) {
    await board.key(key);
  }
  await board.key('enter');
  for (const key of keysBetween(m.from, m.to, probe.orientation)) {
    await board.key(key);
  }
  await board.key('enter');
}

async function playMove(board: BoardPage, rng: Rng, m: OracleMove) {
  const gesture = rng.pick(['drag', 'click', 'keyboard'] as const);
  if (gesture === 'drag') await board.drag(m.from, m.to);
  else if (gesture === 'click') await board.clickMove(m.from, m.to);
  else await keyboardMove(board, m);
  if (m.promotion !== undefined) {
    expect(await board.promotionVisible()).toBe(true);
    await board.promote(m.promotion);
  }
  return gesture;
}

/** A square the piece on `from` cannot legally reach. */
function illegalTarget(fen: string, from: Square, rng: Rng): Square {
  const legal = new Set(legalTargets(fen, from));
  const options = ALL_SQUARES.filter((s) => s !== from && !legal.has(s));
  return rng.pick(options);
}

async function attemptIllegal(board: BoardPage, fen: string, rng: Rng) {
  const own = ALL_SQUARES.filter((s) => pieceAt(fen, s)?.[0] === turnOf(fen));
  const from = rng.pick(own);
  const to = illegalTarget(fen, from, rng);
  // Tapping another own piece re-selects rather than attempting a move.
  if (pieceAt(fen, to)?.[0] === turnOf(fen)) return;
  await board.drag(from, to);
  await board.expectFen(fen);
}

async function runGame(host: ChessBoardHost, seed: number): Promise<void> {
  const rng = createRng(seed);
  const board = await openBoard(host, {
    parent: 'confirm',
    animations: rng.next() < 0.5,
  });
  let fen: string = FEN.start;
  const played: string[] = [];
  const ucis: string[] = [];
  for (let ply = 0; ply < PLIES && !isGameOver(fen); ply += 1) {
    if (rng.next() < 0.25) await attemptIllegal(board, fen, rng);
    if (rng.next() < 0.1) await board.flip();
    const move = rng.pick(allLegalMoves(fen));
    const gesture = await playMove(board, rng, move);
    fen = play(fen, uciOf(move));
    ucis.push(uciOf(move));
    played.push(`${uciOf(move)}:${gesture}`);
    const probe = await board.probe();
    expect({ seed, played, fen: probe.fen }).toEqual({ seed, played, fen });
    expect(probe.lastMove).toEqual({ from: move.from, to: move.to });
    await board.expectConsistent();
  }
  const emitted = (await board.moves()).map(
    (m) => `${m.from}${m.to}${m.promotion ?? ''}`
  );
  expect(emitted).toEqual(ucis);
}

export function defineModelBasedScenarios(host: ChessBoardHost): void {
  describe('model-based random play', () => {
    for (const seed of SEEDS) {
      test(`seed ${seed}: ${PLIES} random plies through every gesture`, async () => {
        await runGame(host, seed);
      }, 120_000);
    }

    test('random promotions: every piece, both colors, via the picker', async () => {
      const rng = createRng(99);
      for (const fen of [FEN.whitePromotion, FEN.blackPromotion]) {
        for (const move of allLegalMoves(fen).filter((m) => m.promotion)) {
          const board = await openBoard(host, {
            fen,
            orientation: rng.pick(['white', 'black'] as const),
          });
          await playMove(board, rng, move);
          await board.expectFen(play(fen, uciOf(move)));
          await board.expectConsistent();
          await host.close();
        }
      }
    }, 120_000);
  });
}
