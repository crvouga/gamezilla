/**
 * The shared laws hold a game to its contract rather than to itself: each
 * faulty copy of the reference game below breaks one law, and that law —
 * and only that law — refuses it, for the reason it names, while the sound
 * game passes every one.
 */

import { expect, test } from 'bun:test';
import type {
  BotDifficulty,
  GameRules,
} from '@pkgs/turn-game-shared/game-rules';
import {
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

test("a game claiming another game's positions is refused", () => {
  expect(
    refusals(faulty({ recognizes: () => true })).get(
      'every position a game reaches is recognized as this game alone'
    )
  ).toContain('it claims chess');
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
      position === 'race:7' && action === 'advance'
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
    canWin: (position, side) => side === 'white' || position === 'race:0',
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
      return played?.position === 'race:6'
        ? { ...played, winner: 'draw', reason: 'tie' }
        : played;
    },
  });
  expect(
    refusals(tied).get(
      'its rules draw it only where the game names a line to it'
    )
  ).toContain('its rules drew at race:6');
});
