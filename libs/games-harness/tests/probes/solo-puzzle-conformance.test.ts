import { expect, test } from 'bun:test';
import {
  gamePuzzleJudgeLaws,
  gamePuzzlePlaybackLaws,
} from '@libs/game-session-harness/game-puzzle-laws';
import { gameRulesLaws } from '@libs/game-session-harness/game-rules-laws';
import {
  assertKnownPuzzles,
  type PuzzleFixture,
} from '@libs/game-session-harness/known-puzzles';
import { wrongMoveAt } from '@libs/game-session-harness/puzzle-moves';
import { COUNTING_RACE_GAME } from '../reference-game/counting-race-game';
import { SOLO_COUNT_GAME } from './solo-count-game';

const fail = (problem: string): never => {
  throw new Error(problem);
};

function wrongMoveLaw(fixtures: readonly PuzzleFixture[]) {
  const wrong = gamePuzzleJudgeLaws({
    ...SOLO_COUNT_GAME,
    fixtures: { ...SOLO_COUNT_GAME.fixtures, puzzles: fixtures },
  }).find((entry) => entry.name === 'its wrong move is judged wrong');
  if (wrong === undefined) throw new Error('Missing wrong-move law');
  return wrong.check;
}

test('extra catalogue puzzles keep the same wrong-move promise as the known examples', () => {
  const more = SOLO_COUNT_GAME.fixtures.morePuzzles ?? [];
  const first = more[0];
  if (first === undefined) throw new Error('Missing extra solo puzzle');
  expect(first.record.position).toBe('solo-count:0w');
  expect(first.record.line).toEqual(Array(7).fill('one'));
  expect(
    wrongMoveLaw([{ ...first, wrongMove: { at: 0, action: 'one' } }])
  ).toThrow();
  expect(wrongMoveLaw(more)).not.toThrow();
});

// regression: solo-probe-no-wrong-opening
test('the solo attempt model can make a wrong opening on the one-two puzzle', () => {
  const fixture = SOLO_COUNT_GAME.fixtures.puzzles?.[2];
  if (fixture === undefined) throw new Error('Missing solo fixture');
  expect(fixture.record.position).toBe('solo-count:4w');
  expect(fixture.record.line).toEqual(['one', 'two']);
  expect(wrongMoveAt(SOLO_COUNT_GAME, fixture, 0)).toBe('stay');
});

// regression: solver-only-puzzle-laws-parity
test('the solo solution is judged and replayed from its first move', () => {
  for (const law of [
    ...gamePuzzleJudgeLaws(SOLO_COUNT_GAME),
    ...gamePuzzlePlaybackLaws(SOLO_COUNT_GAME),
  ])
    expect(law.check).not.toThrow();
});

// regression: solver-only-known-puzzle-parity
test('the declared solo line keeps both solver moves without inventing an opponent input', () => {
  const known = SOLO_COUNT_GAME.fixtures.puzzles?.[0];
  const puzzles = SOLO_COUNT_GAME.shared.turnGame.capabilities.puzzles;
  if (known === undefined || puzzles === undefined)
    throw new Error('Missing solo fixture');
  const { opponentMove: _opponentMove, ...solo } = known;
  expect(solo.record.position).toBe('solo-count:3w');
  expect(solo.record.line).toEqual(['two', 'two']);
  expect(() =>
    assertKnownPuzzles(
      { rules: SOLO_COUNT_GAME.shared.turnGame.rules, puzzles },
      [solo],
      fail
    )
  ).not.toThrow();
});

test('an opponent layout still requires its refused opponent input', () => {
  const known = COUNTING_RACE_GAME.fixtures.puzzles?.[0];
  const puzzles = COUNTING_RACE_GAME.shared.turnGame.capabilities.puzzles;
  if (known === undefined || puzzles === undefined)
    throw new Error('Missing opponent fixture');
  const { opponentMove: _opponentMove, ...missing } = known;
  expect(() =>
    assertKnownPuzzles(
      { rules: COUNTING_RACE_GAME.shared.turnGame.rules, puzzles },
      [missing],
      fail
    )
  ).toThrow('has no opponent move');
});

// regression: solver-only-rules-forced-alternation
test('a puzzle-only counter keeps the rules laws without a fictitious second turn', () => {
  const rules = SOLO_COUNT_GAME.shared.turnGame.rules;
  expect(rules.play('solo-count:0w', 'one', '', [])?.turn).toBe('white');
  const laws = gameRulesLaws(SOLO_COUNT_GAME, [COUNTING_RACE_GAME]);
  expect(laws.length).toBeGreaterThan(0);
  for (const law of laws) expect(law.check).not.toThrow();
});

// regression: solver-only-rules-demand-opponent-victory
test('a one-person puzzle has no second side that could win', () => {
  const rules = SOLO_COUNT_GAME.shared.turnGame.rules;
  expect(rules.recognizes('solo-count:0b')).toBe(false);
  expect(rules.canWin('solo-count:0w', 'white')).toBe(true);
  expect(rules.canWin('solo-count:0w', 'black')).toBe(false);
  const laws = gameRulesLaws(SOLO_COUNT_GAME, [COUNTING_RACE_GAME]);
  for (const law of laws) expect(law.check).not.toThrow();
});
