/**
 * Every game offering puzzles is held to what the platform's puzzle session
 * needs from it, on the known puzzle its harness names (`fixtures.puzzle`,
 * written from the game's own laws): the game accepts its own puzzle; the
 * setup move gives the solver the turn; following the line solves it, each
 * solver move judged as the line's and labelled as the rules name it; a move
 * its rules accept off the line is wrong, never illegal; every move the
 * rules allow at a solver move is judged, never refused; and a hint, a
 * wrong move and a suggestion name cells of its board.
 */

import { expect, test } from 'bun:test';
import { judgePuzzleAction } from '@libs/game-puzzle-shared/puzzle-judge';
import type { PuzzleGame } from '@libs/game-puzzle-shared/puzzle-setup';
import {
  playPuzzleAction,
  positionAt,
  setupPuzzle,
} from '@libs/game-puzzle-shared/puzzle-setup';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import { forEveryGame } from '../game-suite';

function puzzleGameOf(game: HarnessGame): PuzzleGame {
  const puzzles = game.shared.turnGame.capabilities.puzzles;
  if (puzzles === undefined) throw new Error(`${game.label} offers no puzzles`);
  return { rules: game.shared.turnGame.rules, puzzles };
}

function fixtureOf(game: HarnessGame) {
  const fixture = game.fixtures.puzzle;
  if (fixture === undefined)
    throw new Error(`${game.label} names no known puzzle (fixtures.puzzle)`);
  return fixture;
}

forEveryGame(import.meta.path, (game) => {
  test('its namespace is its own and its known puzzle is one of its puzzles', () => {
    const puzzles = puzzleGameOf(game).puzzles;
    const { record } = fixtureOf(game);
    const unprefixed = game.shared.turnGame.unprefixedNamespace === true;
    expect(puzzles.namespace).toBe(unprefixed ? '' : `${game.shared.id}/`);
    if (puzzles.namespace === '') expect(record.id).not.toContain('/');
    else expect(record.id.startsWith(puzzles.namespace)).toBe(true);
    expect(puzzles.content.validate(record)).toEqual({ ok: true });
    if (puzzles.content.positionKey !== undefined)
      expect(puzzles.content.positionKey(record)).toBe(
        puzzles.content.positionKey({ ...record })
      );
  });

  test('the setup move gives the solver the turn, and following the line solves it', () => {
    const puzzleGame = puzzleGameOf(game);
    const { record } = fixtureOf(game);
    const setup = setupPuzzle(puzzleGame, record.position, record.line);
    if (setup.kind !== 'ready') throw new Error('the known puzzle is invalid');
    const setupMove = playPuzzleAction(
      puzzleGame,
      record.position,
      record.line[0] ?? ''
    );
    expect(setup.solverSide).toBe(setupMove?.played.turn ?? 'white');
    let line = record.line;
    let position = setup.displayPosition;
    for (let idx = 1; idx < line.length; idx += 2) {
      const verdict = judgePuzzleAction({
        game: puzzleGame,
        position,
        line,
        idx,
        solverSide: setup.solverSide,
        action: line[idx] ?? '',
      });
      if (verdict.kind !== 'correct')
        throw new Error(
          `the line's move ${String(line[idx])} is ${verdict.kind}`
        );
      expect(['line', 'win']).toContain(verdict.via);
      expect<string | undefined>(verdict.label).toBe(
        playPuzzleAction(puzzleGame, position, line[idx] ?? '')?.played.label
      );
      line = verdict.line;
      if (verdict.ends) {
        expect(idx + 1).toBe(line.length);
        return;
      }
      const reply = playPuzzleAction(
        puzzleGame,
        verdict.position,
        line[idx + 1] ?? ''
      );
      if (reply === null) throw new Error('the line’s reply is refused');
      position = reply.played.position;
      expect<string | null>(position).toBe(
        positionAt(puzzleGame, record.position, line, idx + 2)
      );
    }
    throw new Error('following the line never ended the puzzle');
  });

  test('a move its rules accept is judged, never refused, and its wrong move is wrong', () => {
    const puzzleGame = puzzleGameOf(game);
    const { record, wrongAction } = fixtureOf(game);
    const setup = setupPuzzle(puzzleGame, record.position, record.line);
    if (setup.kind !== 'ready') throw new Error('the known puzzle is invalid');
    const judge = (action: string) =>
      judgePuzzleAction({
        game: puzzleGame,
        position: setup.displayPosition,
        line: record.line,
        idx: 1,
        solverSide: setup.solverSide,
        action,
      });
    for (const action of puzzleGame.rules.legal(setup.displayPosition))
      expect({ action, kind: judge(action).kind }).not.toEqual({
        action,
        kind: 'illegal',
      });
    expect(judge(wrongAction)).toMatchObject({ kind: 'wrong' });
  });

  test('a hint, a wrong move and a suggestion name cells of its board', () => {
    const puzzleGame = puzzleGameOf(game);
    const { record, wrongAction } = fixtureOf(game);
    const { puzzles } = puzzleGame;
    const setup = setupPuzzle(puzzleGame, record.position, record.line);
    if (setup.kind !== 'ready') throw new Error('the known puzzle is invalid');
    const named = [
      { at: setup.displayPosition, action: record.line[1] ?? '' },
      { at: setup.displayPosition, action: wrongAction },
    ];
    for (const { at, action } of named) {
      const marks = puzzles.marks(at, action);
      if (marks === null) throw new Error(`${action} names no cells`);
      expect(puzzles.isCell(marks.to)).toBe(true);
      if (marks.from !== null) expect(puzzles.isCell(marks.from)).toBe(true);
    }
    expect(puzzles.isCell('')).toBe(false);
    expect(puzzles.isCell('not a cell at all')).toBe(false);
  });
});
