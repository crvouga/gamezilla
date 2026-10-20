/**
 * The platform's puzzle setup and judge over a game it knows nothing
 * about: take one or two stones from a pile, and whoever takes the last
 * stone wins. Positions are `pile:<stones>:<side to move>`.
 */

import { describe, expect, test } from 'bun:test';
import { judgePuzzleAction } from '@libs/game-puzzle-shared/puzzle-judge';
import { positionAt, setupPuzzle } from '@libs/game-puzzle-shared/puzzle-setup';
import { PILE_GAME as game } from './pile-game';

describe('a puzzle of a game the platform knows nothing about', () => {
  test('the setup move gives the solver the turn, and replay follows the line', () => {
    expect(setupPuzzle(game, 'pile:7:black', ['take1', 'take2'])).toEqual({
      kind: 'ready',
      solveIdx: 1,
      displayPosition: 'pile:6:white',
      solverSide: 'white',
      status: 'solving',
    });
    expect(setupPuzzle(game, 'pile:7:black', ['take1'])).toMatchObject({
      status: 'solved',
    });
    expect(setupPuzzle(game, 'other:7', ['take1'])).toEqual({
      kind: 'invalid',
    });
    expect(setupPuzzle(game, 'pile:0:black', ['take1'])).toEqual({
      kind: 'invalid',
    });
    const line = ['take1', 'take2', 'take1', 'take2'];
    expect(positionAt(game, 'pile:9:black', line, 3)).toBe('pile:5:white');
    expect(positionAt(game, 'pile:9:black', line, 0)).toBeNull();
  });

  test('the line move follows the line, spelled as the game spells it', () => {
    const verdict = judgePuzzleAction({
      game,
      position: 'pile:8:white',
      line: ['take1', 'take2', 'take1', 'take2'],
      idx: 1,
      solverSide: 'white',
      action: ' TAKE2 ',
    });
    expect(verdict).toMatchObject({
      kind: 'correct',
      via: 'line',
      action: 'take2',
      label: '−2',
      position: 'pile:6:black',
      ends: false,
    });
  });

  test('a move that wins for the solver solves the puzzle, off the line too', () => {
    expect(
      judgePuzzleAction({
        game,
        position: 'pile:2:white',
        line: ['take1', 'take1', 'take1', 'take1'],
        idx: 1,
        solverSide: 'white',
        action: 'take2',
      })
    ).toMatchObject({
      kind: 'correct',
      via: 'win',
      line: ['take1', 'take2'],
      ends: true,
    });
  });

  test('the next solver move played one turn early transposes when the positions agree', () => {
    expect(
      judgePuzzleAction({
        game,
        position: 'pile:9:white',
        line: ['take1', 'take1', 'take2', 'take2', 'take1'],
        idx: 1,
        solverSide: 'white',
        action: 'take2',
      })
    ).toMatchObject({
      kind: 'correct',
      via: 'transposition',
      line: ['take1', 'take2', 'take2', 'take1', 'take1'],
      ends: false,
    });
  });

  test('a move the game accepts off the line is wrong, and one it refuses is illegal', () => {
    const line = ['take1', 'take1', 'take1', 'take1'];
    expect(
      judgePuzzleAction({
        game,
        position: 'pile:8:white',
        line,
        idx: 1,
        solverSide: 'white',
        action: 'take2',
      })
    ).toEqual({ kind: 'wrong', action: 'take2', label: '−2' });
    expect(
      judgePuzzleAction({
        game,
        position: 'pile:8:white',
        line,
        idx: 1,
        solverSide: 'white',
        action: 'take3',
      })
    ).toEqual({ kind: 'illegal' });
  });
});
