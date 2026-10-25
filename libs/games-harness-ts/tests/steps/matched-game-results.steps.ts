/**
 * A matched game decided by the game's own rules: its known victory
 * (`firstSideVictory`), and its known line to a draw (`drawByRules`), which
 * only games whose fixtures name one run (`SHARED_SPECIFICATIONS`: a draw by
 * the game's own rules).
 */

import { expect } from 'bun:test';
import {
  acceptedMoves,
  bothBoards,
  move,
  pairOf,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { gameOf, turnGameOf } from './game-world';
import { pairedAt } from './matched-game';

/** The game's known line its own rules draw. */
function drawingLine(w: HarnessWorld): readonly string[] {
  const line = turnGameOf(w).fixtures.drawByRules;
  if (line === undefined)
    throw new Error(`${gameOf(w).label} names no line its rules draw`);
  return line;
}

Given(
  '{actor} has the first side against {actor} in a matched game one move from her victory',
  async (w, first: string, second: string) => {
    const victory = turnGameOf(w).fixtures.firstSideVictory;
    await pairedAt(w, first, second);
    await acceptedMoves(w, victory.slice(0, -1));
    w.memo.set('winning-move', victory.at(-1));
  }
);
Given(
  '{actor} has won the matched game with the winning move',
  async (w, first: string) => {
    await pairedAt(w, first, 'bob');
    await acceptedMoves(w, turnGameOf(w).fixtures.firstSideVictory);
  }
);
Given(
  "{actor} has the first side against {actor} in a matched game one move from a draw by the game's own rules",
  async (w, first: string, second: string) => {
    await pairedAt(w, first, second);
    await acceptedMoves(w, drawingLine(w).slice(0, -1));
  }
);

When('the person whose turn it is makes the drawing move', async (w) => {
  const line = drawingLine(w);
  await move(w, pairOf(w)[(line.length - 1) % 2]!, line.at(-1)!);
});

Then(
  "both people see the matched game is drawn by the game's own rules",
  async (w) => {
    const game = await bothBoards(w, (g) => g.outcome !== 'ongoing');
    expect(game.outcome).toBe('draw');
    expect(game.revision).toBe(drawingLine(w).length);
    expect(game.reason).not.toBe('agreement');
  }
);
