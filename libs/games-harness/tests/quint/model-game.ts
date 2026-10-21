/**
 * The game a model trace is replayed for, and the words the custom-game and
 * matched-game models use for what the product shows: the first and second
 * side for its two sides, and results by side.
 *
 * Every game model follows the first side's known victory
 * (`GameFixtures.firstSideVictory`), never one game's line:
 * - `custom-game-control`, `matched-game` and `matched-game-daily` play the
 *   whole victory, so it takes exactly {@link VICTORY_MOVES} moves (the
 *   models' `VICTORY_MOVES`), the last one winning;
 * - `custom-game-play` plays its first three moves, `custom-game-local` and
 *   `matched-game-own-board` their first four, `custom-game` up to its first
 *   three before finishing it, `matched-game-clock-recovery` its first four
 *   and `matched-game-shared` and `matched-game-spaces` the first move of
 *   each side, all unfinished games because the victory is longer.
 * Seven is the shortest victory every enrolled game can show (four in a row
 * needs seven moves). The three whole-victory models hold only for a game
 * whose known victory takes exactly seven (the trait "a seven-move victory");
 * a game whose every victory is longer (Battleship sinks seventeen cells) is
 * held to the models that play the start of it. A known victory shorter than
 * seven fails here, naming it, before any trace runs.
 */

import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import type { CustomGameSide } from '@libs/game-session-shared/custom-game-state';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { conformanceGameOf } from '../conformance-world';

/** The moves of the victory the game models follow. */
export const VICTORY_MOVES = 7;

/** `game`'s victory, or a failure saying what the models need of it. */
export function victoryOf(game: HarnessGame): readonly string[] {
  const victory = game.fixtures.firstSideVictory;
  if (victory.length < VICTORY_MOVES)
    throw new Error(
      `${game.label}: the game models (specs/games/custom-game*.qnt, matched-game*.qnt) follow a first-side victory of at least ${String(VICTORY_MOVES)} moves, but its firstSideVictory takes ${String(victory.length)} — give it a victory of ${String(VICTORY_MOVES)} moves or more`
    );
  return victory;
}

/** The game this trace is replayed for, with a victory the models can follow. */
export function modelGameOf(w: QuintHarnessWorld): HarnessGame {
  const game = conformanceGameOf(w.ctx.variant, w.ctx.title);
  victoryOf(game);
  return game;
}

/** The victory's move after `played` moves of it. */
export function victoryMoveAt(w: QuintHarnessWorld, played: number): string {
  const game = modelGameOf(w);
  const move = victoryOf(game)[played];
  if (move === undefined)
    throw new Error(
      `${game.label}: the model asks for move ${String(played + 1)} of a ${String(VICTORY_MOVES)}-move victory`
    );
  return move;
}

/** A move the game refuses, as a modified device could still send it. */
export function refusedMoveOf(w: QuintHarnessWorld): string {
  const game = modelGameOf(w);
  const refused = game.fixtures.refusedOpenings[0];
  if (refused === undefined)
    throw new Error(`${game.label} names no move its rules refuse`);
  return refused;
}

const MODEL_SIDE: Readonly<Record<CustomGameSide, string>> = {
  white: 'first',
  black: 'second',
};

/** The model's name for the product's side. */
export function modelSide(side: CustomGameSide): string {
  return MODEL_SIDE[side];
}

/** The product's side the model names. */
export function productSide(side: string): CustomGameSide {
  if (side === 'first') return 'white';
  if (side === 'second') return 'black';
  throw new Error(`The models have no side "${side}"`);
}

/**
 * The model's result for the product's: a victory by side and how it came
 * (resignation, time, staying away, or the game's own rules, whatever they
 * call it), a draw, or a cancellation.
 */
export function modelResult(outcome: string): string {
  const away = /^(white|black) wins because (white|black) stayed away$/.exec(
    outcome
  );
  if (away !== null)
    return `${modelSide(away[1] as CustomGameSide)} side wins because the ${modelSide(away[2] as CustomGameSide)} side stayed away`;
  const win = /^(white|black) wins (by resignation|on time|by .+)$/.exec(
    outcome
  );
  if (win === null) return outcome;
  const how =
    win[2] === 'by resignation' || win[2] === 'on time'
      ? win[2]
      : "by the game's rules";
  return `${modelSide(win[1] as CustomGameSide)} side wins ${how}`;
}
