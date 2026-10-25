/**
 * Probe: a completion result that is not simply one winner and one loser.
 *
 * Supported (executable): a result the mover does not win. The rules name
 * the winner (`PlayedPosition.winner`), and a custom game credits that
 * side — the probe found custom games crediting the mover instead
 * (regression `custom-game-mover-credited-win`, fixed in
 * `custom-game-play`). A margin or score can be told only as the ending's
 * reason, which the presentation describes (`endingDescription(reason)`).
 *
 * Supported (executable): joint winners. A result is one side, a draw,
 * or several sides (`GameWinner`, Hearts' tie for the lowest score); its
 * plainest form (`plainWinner`) is a draw when it goes to every seat. A
 * custom game stores it as `white and red win by …` and credits each
 * winner (`specs/games/shared-victories.feature`).
 *
 * Limitation (executable, type-level): a ranking or a score the platform
 * rates or counts is not expressible — a score is told only as the
 * ending's reason. A matched game records one winner or a draw, since its
 * Glicko-2 ratings compare people by a win, a loss or a draw.
 */

import { expect, test } from 'bun:test';
import { establishCustomGame } from '@libs/game-session-harness-ts/custom-game-lineup';
import { makeCustomGameMove } from '@libs/game-session-harness-ts/custom-game-moves';
import { readCustomGameScreen } from '@libs/game-session-harness-ts/custom-game-screen';
import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness-ts/game-system';
import {
  customGameOutcome,
  customGameWinners,
} from '@libs/game-session-shared-ts/custom-game-outcome';
import {
  type GameRecordMetadata,
  type PlayedPosition,
  plainWinner,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { refusals } from '../reference-game/faulty-game';
import { MISERE_TALLY_GAME } from './misere-tally-game';

test('a game whose ending move loses for its mover keeps every law', () => {
  expect([...refusals(MISERE_TALLY_GAME).keys()]).toEqual([]);
});

const SYSTEM = gameSystem('misere-tally', [MISERE_TALLY_GAME]);

test('a custom game credits the side the rules name, not the side that moved last', async () => {
  await using s = await openGameHarness(SYSTEM, 'misere-tally-probe');
  const victory = MISERE_TALLY_GAME.fixtures.firstSideVictory;
  await s.apply(establishCustomGame, 'misere-tally', {
    moves: victory.slice(0, -1),
  });
  // Bob, on the second side, is left to count from six to seven.
  await s.apply(makeCustomGameMove, 'bob', 'misere-tally', victory.at(-1));
  const finished = (await s.read(readCustomGameScreen, 'alice'))?.current;
  expect(finished?.status).toBe('completed');
  expect(finished?.outcome).toBe('white wins by counted to seven');
}, 120_000);

test('a result names one side, a draw, joint winners or none, but never a score', () => {
  const ended: PlayedPosition['winner'][] = [
    'white',
    'black',
    'draw',
    ['white', 'red'],
    null,
  ];
  const outcome: GameRecordMetadata['outcome'][] = ['white', 'draw'];
  // @ts-expect-error: a game record's result is a side, a draw or sides, never a score.
  outcome.push({ white: 12, black: 9 });
  expect([ended.length, outcome.length]).toEqual([5, 3]);
});

test('joint winners are a draw when they are every seat, and named in seat order otherwise', () => {
  const sides = ['white', 'black', 'red', 'blue'] as const;
  expect(plainWinner(['red', 'white'], sides)).toEqual(['white', 'red']);
  expect(plainWinner(['blue', 'red', 'black', 'white'], sides)).toBe('draw');
  expect(plainWinner(['black'], sides)).toBe('black');
  expect(() => plainWinner([], sides)).toThrow();
});

test('a custom game stores joint winners and credits each of them', () => {
  const sides = ['white', 'black', 'red', 'blue'] as const;
  const outcome = customGameOutcome(['blue', 'white'], 'lowest score', sides);
  expect(outcome).toBe('white and blue win by lowest score');
  expect(
    customGameWinners({ status: 'completed', outcome, sides: [...sides] })
  ).toEqual(['white', 'blue']);
});
