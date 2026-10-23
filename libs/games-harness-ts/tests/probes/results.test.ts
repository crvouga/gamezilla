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
 * Limitation (executable, type-level): a result is one side, a draw or
 * nothing (`PlayedPosition.winner: GameSide | 'draw' | null`; a record's
 * `GameRecordMetadata.outcome: GameSide | 'draw'`). A shared win, a ranking
 * or a score the platform rates or counts is not expressible; history
 * statistics count wins, losses and draws, and ratings are Glicko-2 on
 * win/draw/loss. Extending it means widening `winner` and `outcome`, the
 * stored `outcome` of custom and matched games, the ratings and history
 * statistics, and the shared result copy.
 */

import { expect, test } from 'bun:test';
import { establishCustomGame } from '@libs/game-session-harness-ts/custom-game-lineup';
import { makeCustomGameMove } from '@libs/game-session-harness-ts/custom-game-moves';
import { readCustomGameScreen } from '@libs/game-session-harness-ts/custom-game-screen';
import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness-ts/game-system';
import type {
  GameRecordMetadata,
  PlayedPosition,
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

test('a result is one side, a draw or none: nothing shared, ranked or scored', () => {
  const ended: PlayedPosition['winner'][] = ['white', 'black', 'draw', null];
  // @ts-expect-error: no result names both sides (a shared win).
  ended.push('both');
  const outcome: GameRecordMetadata['outcome'][] = ['white', 'draw'];
  // @ts-expect-error: a game record's result is a side or a draw, never a score.
  outcome.push({ white: 12, black: 9 });
  expect([ended.length, outcome.length]).toEqual([5, 3]);
});
