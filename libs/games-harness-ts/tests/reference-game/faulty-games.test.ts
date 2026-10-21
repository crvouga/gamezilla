/**
 * The shared laws hold a game to its contract rather than to itself: each
 * faulty copy of the reference game below breaks one law, and that law —
 * and only that law — refuses it, for the reason it names, while the sound
 * game passes every one.
 */

import { expect, test } from 'bun:test';
import { assertHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import type { PuzzleFixture } from '@libs/game-session-harness-ts/known-puzzles';
import type { PuzzlesCapability } from '@pkgs/turn-game-shared-ts/game-puzzles';
import type {
  BotDifficulty,
  GameRules,
} from '@pkgs/turn-game-shared-ts/game-rules';
import {
  COUNTING_RACE_FIXTURES,
  COUNTING_RACE_GAME,
  COUNTING_RACE_PUZZLES,
  COUNTING_RACE_RULES,
  COUNTING_RACE_TURN_GAME,
} from './counting-race-game';
import { definedWith, refusals } from './faulty-game';

const rules = COUNTING_RACE_RULES;

/** The reference game with `fault` in its rules. */
function faulty(fault: Partial<GameRules>) {
  return definedWith({ rules: { ...rules, ...fault } });
}

/** `game` is refused by `law` alone, for a reason saying `reason`. */
function expectRefusedBy(
  game: ReturnType<typeof definedWith>,
  law: string,
  reason: string
): void {
  const refused = refusals(game);
  expect([...refused.keys()]).toEqual([law]);
  expect(refused.get(law)).toContain(reason);
}

test('the sound reference game keeps every law', () => {
  expect([...refusals(definedWith({})).keys()]).toEqual([]);
});

test('a game accepting an action it does not offer is refused', () => {
  const lenient = faulty({
    play: (position, action, history, actions) =>
      rules.play(
        position,
        action === 'retreat' ? 'advance' : action,
        history,
        actions
      ),
  });
  expect(
    refusals(lenient).get('the known refused openings are refused')
  ).toContain('the opening retreat was accepted');
});

test('a game whose replay forgets the actions is refused', () => {
  expect(
    refusals(faulty({ replay: () => rules.initial() })).get(
      'replaying the accepted actions reproduces every position, deterministically'
    )
  ).toContain('reached another position');
});

// regression: game-conformance-fault-probes-production-default
test("a game claiming another game's positions is refused", () => {
  expect(
    refusals(faulty({ recognizes: () => true })).get(
      'every position a game reaches is recognized as this game alone'
    )
  ).toContain("it claims setup race's setup-race:__:00w");
});

test('a game showing moves other than those played is refused', () => {
  expectRefusedBy(
    faulty({ moves: () => [] }),
    'the moves shown are the accepted actions, labelled as they were played',
    'the moves shown differ from the moves played'
  );
});

test('a game still playable after its victory is refused', () => {
  const endless = faulty({
    play: (position, action, history, actions) =>
      position === 'race:7b' && action === 'advance'
        ? {
            position,
            history,
            turn: 'white',
            label: 'step 8',
            winner: null,
            reason: null,
          }
        : rules.play(position, action, history, actions),
  });
  expect(
    refusals(endless).get(
      'the known victory finishes the game for the first side and nothing follows it'
    )
  ).toContain('a won game accepted advance');
});

test('a game accepting a legal move under another spelling is refused', () => {
  // As chess once did with `b2b3a`: the action is a legal move, misspelt.
  const lenient = faulty({
    play: (position, action, history, actions) =>
      rules.play(
        position,
        action === 'advance!' ? 'advance' : action,
        history,
        actions
      ),
  });
  expectRefusedBy(
    lenient,
    'only a legal action is accepted, and a finished game accepts none',
    'advance! was accepted against its legality'
  );
});

test('a bot choosing an action the rules do not offer is refused', () => {
  const reckless = definedWith({
    capabilities: {
      ...COUNTING_RACE_TURN_GAME.capabilities,
      'custom-games': {
        bots: { difficulties: ['easy'], choose: () => 'retreat' },
      },
    },
  });
  expectRefusedBy(
    reckless,
    'two bots play only legal actions until the game finishes',
    'a bot chose retreat'
  );
});

test('an automated participant choosing an action the rules do not offer is refused', () => {
  const reckless = definedWith({
    automation: {
      ...COUNTING_RACE_TURN_GAME.automation,
      choose: () => 'retreat',
    },
  });
  expectRefusedBy(
    reckless,
    'the automated participant only ever chooses a legal action',
    'the automated participant chose retreat'
  );
});

test('a strength offered twice is refused when the game is defined, and by the bot laws after', () => {
  const choose = () => 'advance';
  expect(() =>
    definedWith({
      capabilities: {
        'custom-games': { bots: { difficulties: ['easy', 'easy'], choose } },
      },
    })
  ).toThrow('counting-race: a bot difficulty is offered twice');
  // A game changing its strengths after it was defined meets the law.
  const difficulties: BotDifficulty[] = ['easy'];
  const changed = definedWith({
    capabilities: { 'custom-games': { bots: { difficulties, choose } } },
  });
  difficulties.push('easy');
  expectRefusedBy(
    changed,
    'each strength is offered once',
    'a strength is offered twice'
  );
});

test('a game whose side cannot win without naming a line to it is refused', () => {
  // Past its first count the second side can no longer win, yet the game
  // names no line where that happens.
  const hopeless = faulty({
    canWin: (position, side) => side === 'white' || position === 'race:0w',
  });
  expectRefusedBy(
    hopeless,
    'a side cannot win only where the game names a line to it',
    'which the game names no line to'
  );
});

test('a game its rules draw without naming a line to it is refused', () => {
  // Counting to six draws the race, yet the game names no line its rules
  // draw.
  const tied = faulty({
    play: (position, action, history, actions) => {
      const played = rules.play(position, action, history, actions);
      return played?.position === 'race:6w'
        ? { ...played, winner: 'draw', reason: 'tie' }
        : played;
    },
  });
  expect(
    refusals(tied).get(
      'its rules draw it only where the game names a line to it'
    )
  ).toContain('its rules drew at race:6w');
});

/** The reference game with `fault` in its puzzles capability. */
function faultyPuzzles(fault: Partial<PuzzlesCapability>) {
  return definedWith({
    capabilities: {
      ...COUNTING_RACE_TURN_GAME.capabilities,
      puzzles: { ...COUNTING_RACE_PUZZLES, ...fault },
    },
  });
}

/** The reference game's known puzzle `counting-race/<id>`. */
function knownPuzzle(id: string): PuzzleFixture {
  const found = COUNTING_RACE_FIXTURES.puzzles.find(
    (fixture) => fixture.record.id === `counting-race/${id}`
  );
  if (found === undefined) throw new Error(`no known puzzle ${id}`);
  return found;
}

const LEAP_HOME = knownPuzzle('leap-home');
const LEAP_PAST_FOUR = knownPuzzle('leap-past-four');
const EITHER_ORDER = knownPuzzle('either-order');

/** The reference game's adapter with its known puzzles replaced. */
function withKnownPuzzles(...puzzles: [PuzzleFixture, ...PuzzleFixture[]]) {
  return {
    ...COUNTING_RACE_GAME,
    fixtures: { ...COUNTING_RACE_FIXTURES, puzzles },
  };
}

test('a puzzle judge spelling a leap as an advance is refused by the solution it then misjudges', () => {
  // Its spelling makes the Hare's leap to three an advance to two: the
  // line's move, as the judge now reads it, but not the move the solver
  // made; and the Hare's wrong count of one reads as the line's leap.
  const misspelling = faultyPuzzles({
    judge: {
      canonical: (_position, action) =>
        action === 'leap' ? 'advance' : action,
    },
  });
  const refused = refusals(misspelling);
  expect(
    refused.get(
      'following the solution solves the puzzle, each move as the line names it'
    )
  ).toContain(
    "counting-race/leap-home: the solution's leap is labelled step 2, not leap to 3"
  );
  expect(refused.get('its wrong move is judged wrong')).toContain(
    'counting-race/leap-home: the wrong move advance is judged correct (line)'
  );
  // Its rules, presentation and record are untouched.
  for (const law of refused.keys()) expect(law).not.toContain('known victory');
});

test('a puzzle board whose marks name no cells of the board is refused', () => {
  const offBoard = faultyPuzzles({
    marks: (position, action) => {
      const marks = COUNTING_RACE_PUZZLES.marks(position, action);
      return marks === null ? null : { from: null, to: `cell-${marks.to}` };
    },
  });
  expectRefusedBy(
    offBoard,
    'a hint, a wrong move and a suggestion name cells of its board',
    'leap ends on cell-3, not a cell'
  );
});

// regression: game-conformance-fault-probes-production-default
test("a puzzle validation accepting another game's position is refused", () => {
  const lenient = faultyPuzzles({
    content: { validate: () => ({ ok: true }) },
  });
  expectRefusedBy(
    lenient,
    "its content validation refuses every other game's known puzzle",
    "it accepts solo count's known puzzle solo-count/two-twos as its own"
  );
});

test("a puzzle namespace taken from the durable game, or another game's, is refused when the game is defined", () => {
  expect(() => faultyPuzzles({ namespace: '' })).toThrow(
    'counting-race: the unprefixed puzzle namespace "" belongs to the platform\'s durable game alone — use "counting-race/"'
  );
  expect(() => faultyPuzzles({ namespace: 'chess/' })).toThrow(
    'counting-race: puzzle namespace "chess/" is not "counting-race/"'
  );
});

test('known puzzles the rules contradict, or outside the namespace, are refused when the adapter is made', () => {
  const misnamed = {
    ...LEAP_HOME,
    labels: ['step 1', 'leap to 3', 'leap to 5', 'step 7'],
  };
  expect(() =>
    assertHarnessGame(withKnownPuzzles(misnamed, LEAP_PAST_FOUR))
  ).toThrow(
    "counting race: the known puzzle counting-race/leap-home's line move leap is written leap to 7, not step 7"
  );
  const wrongSide = { ...LEAP_PAST_FOUR, solverSide: 'white' as const };
  expect(() => assertHarnessGame(withKnownPuzzles(wrongSide))).toThrow(
    "counting-race/leap-past-four's setup move gives black the turn, not white"
  );
  const winning = { ...LEAP_HOME, wrongMove: { at: 3, action: 'leap' } };
  expect(() =>
    assertHarnessGame(withKnownPuzzles(winning, LEAP_PAST_FOUR))
  ).toThrow("counting-race/leap-home's wrong move leap is a win");
  const legal = { ...LEAP_PAST_FOUR, refusedMove: { at: 1, action: 'leap' } };
  expect(() => assertHarnessGame(withKnownPuzzles(legal))).toThrow(
    "counting-race/leap-past-four's refused move leap is accepted"
  );
  const borrowed = {
    ...EITHER_ORDER,
    record: { ...EITHER_ORDER.record, id: 'either-order' },
  };
  expect(() =>
    assertHarnessGame(withKnownPuzzles(borrowed, LEAP_PAST_FOUR))
  ).toThrow(
    'the known puzzle either-order is not in the namespace "counting-race/"'
  );
});
