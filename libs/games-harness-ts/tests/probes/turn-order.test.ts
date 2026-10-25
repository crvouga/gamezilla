/**
 * Probe: actions that are not conventional alternating turns.
 *
 * Supported (executable) for custom games. Every `PlayedPosition` names the
 * side to move (`turn`), and the custom-game engine seats each move by it.
 * A game whose rules decide the turn says so (`GameRules.turnOrder:
 * 'rules'`, as Hearts does: a trick's winner leads); the rules laws then
 * hold it to its own turns, and the rotating-turn specifications
 * (`rotating turns`) do not bind it. A game that does not declare it is
 * still held to rotation and refused by that law alone.
 *
 * Limitation: matchmaking still assumes rotation — a matched game's abort
 * window and clock start (`bothHaveMoved`: two accepted moves) and its move
 * numbering (plies in pairs) — so `defineGame` refuses a matched game with
 * `turnOrder: 'rules'`.
 */

import { expect, test } from 'bun:test';
import { bothHaveMoved } from '@libs/game-matchmaking-shared-ts/game-state';
import { establishCustomGame } from '@libs/game-session-harness-ts/custom-game-lineup';
import { readCustomGameScreen } from '@libs/game-session-harness-ts/custom-game-screen';
import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness-ts/game-system';
import { assertHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { refusals } from '../reference-game/faulty-game';
import {
  DOUBLE_TURN_BY_RULES_GAME,
  DOUBLE_TURN_GAME,
  DOUBLE_TURN_RULES,
} from './double-turn-game';
import { TAKES_TURNS_LAW } from './probe-verdict';

test('a game whose first side moves twice is refused by the turn law alone', () => {
  const refused = refusals(DOUBLE_TURN_GAME);
  expect([...refused.keys()]).toEqual([TAKES_TURNS_LAW]);
  expect(refused.get(TAKES_TURNS_LAW)).toContain(
    "after white's one at ply 1 it is white's turn, not black's"
  );
});

test('the same game, declaring that its rules decide the turn, keeps every law', () => {
  expect([...refusals(DOUBLE_TURN_BY_RULES_GAME).keys()]).toEqual([]);
});

test("a matched game's abort window counts two accepted moves as both people having moved", () => {
  const rules = DOUBLE_TURN_RULES;
  const first = rules.play(rules.initial(), 'one', '', []);
  const second = rules.play(first?.position ?? '', 'one', '', ['one']);
  // Only the first side has moved…
  expect([first?.turn, second?.turn]).toEqual(['white', 'black']);
  // …yet a matched game at revision 2 has "both people moved": its clock
  // runs and aborting has ended.
  expect(bothHaveMoved({ revision: 2 })).toBe(true);
});

const SYSTEM = gameSystem('double-turn', [assertHarnessGame(DOUBLE_TURN_GAME)]);

test('the custom-game engine itself seats each move by the turn the rules give', async () => {
  await using s = await openGameHarness(SYSTEM, 'double-turn-probe');
  // Alice (first side) moves twice in a row; the lineup plays each move
  // by whoever the game says has the turn.
  await s.apply(establishCustomGame, 'double-turn', { moves: ['one', 'one'] });
  const shown = (await s.read(readCustomGameScreen, 'bob'))?.current;
  expect(shown?.moves.map((move) => move.san)).toEqual([
    'one to 1',
    'one to 2',
  ]);
  expect(shown?.turn).toBe('black');
}, 120_000);
