/**
 * Probe: actions that are not conventional alternating turns.
 *
 * Limitation (executable). The rules contract can say it — every
 * `PlayedPosition` names the side to move (`turn`), and the custom-game
 * engine seats each move by it — but alternation is the platform's
 * contract, not one game's habit: `specs/games/game-turns.feature` ("A
 * participant's move passes the turn", "Then it is Bob's turn"), the
 * custom-game and matched-game models ("sides take turns"), a matched
 * game's abort window and clock start (`bothHaveMoved`: two accepted
 * moves), its move list numbering (`multiplayer-format`: plies in pairs)
 * and a puzzle's line (solver and opponent by parity). So the rules laws
 * hold every turn game to it, and refuse this one by that law alone.
 */

import { expect, test } from 'bun:test';
import { bothHaveMoved } from '@libs/game-matchmaking-shared/game-state';
import { establishCustomGame } from '@libs/game-session-harness/custom-game-lineup';
import { readCustomGameScreen } from '@libs/game-session-harness/custom-game-screen';
import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness/game-system';
import { assertHarnessGame } from '@libs/game-session-harness/harness-game';
import { refusals } from '../reference-game/faulty-game';
import { DOUBLE_TURN_GAME, DOUBLE_TURN_RULES } from './double-turn-game';
import { TAKES_TURNS_LAW } from './probe-verdict';

test('a game whose first side moves twice is refused by the turn law alone', () => {
  const refused = refusals(DOUBLE_TURN_GAME);
  expect([...refused.keys()]).toEqual([TAKES_TURNS_LAW]);
  expect(refused.get(TAKES_TURNS_LAW)).toContain(
    "after white's one at ply 1 it is white's turn, not black's"
  );
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
