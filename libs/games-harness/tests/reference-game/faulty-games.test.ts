/**
 * The shared laws hold a game to its contract rather than to itself: each
 * faulty copy of the reference game below breaks one law, and that law
 * refuses it while the sound game passes every one.
 */

import { expect, test } from 'bun:test';
import {
  gameBotLaws,
  gameRulesLaws,
} from '@libs/game-session-harness/game-rules-laws';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import { HARNESS_GAMES } from '@libs/games-harness/harness-games';
import type { GameRules } from '@pkgs/turn-game-shared/game-rules';
import { COUNTING_RACE_GAME } from './counting-race-game';

const sound = COUNTING_RACE_GAME;
const rules = sound.shared.turnGame.rules;

/** The reference game with `fault` in its rules. */
function faulty(fault: Partial<GameRules>): HarnessGame {
  const turnGame = sound.shared.turnGame;
  return {
    ...sound,
    shared: {
      ...sound.shared,
      turnGame: { ...turnGame, rules: { ...rules, ...fault } },
    },
  };
}

function broken(game: HarnessGame): readonly string[] {
  return [...gameRulesLaws(game, HARNESS_GAMES), ...gameBotLaws(game)]
    .filter((law) => {
      try {
        law.check();
        return false;
      } catch {
        return true;
      }
    })
    .map((law) => law.name);
}

test('the sound reference game keeps every law', () => {
  expect(broken(sound)).toEqual([]);
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
  expect(broken(lenient)).toContain('the known refused openings are refused');
});

test('a game whose replay forgets the actions is refused', () => {
  expect(broken(faulty({ replay: () => rules.initial() }))).toContain(
    'replaying the accepted actions reproduces every position, deterministically'
  );
});

test("a game claiming another game's positions is refused", () => {
  expect(broken(faulty({ recognizes: () => true }))).toContain(
    'every position a game reaches is recognized as this game alone'
  );
});

test('a game showing moves other than those played is refused', () => {
  expect(broken(faulty({ moves: () => [] }))).toContain(
    'the moves shown are the accepted actions, labelled as they were played'
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
  expect(broken(endless)).toContain(
    'the known victory finishes the game for the first side and nothing follows it'
  );
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
  expect(broken(lenient)).toContain(
    'only a legal action is accepted, and a finished game accepts none'
  );
});

test('a bot choosing an action the rules do not offer is refused', () => {
  const customGames = sound.shared.turnGame.capabilities['custom-games']!;
  const reckless: HarnessGame = {
    ...sound,
    shared: {
      ...sound.shared,
      turnGame: {
        ...sound.shared.turnGame,
        capabilities: {
          ...sound.shared.turnGame.capabilities,
          'custom-games': {
            bots: { ...customGames.bots, choose: () => 'retreat' },
          },
        },
      },
    },
  };
  expect(broken(reckless)).toContain(
    'two bots play only legal actions until the game finishes'
  );
});

test('a game whose side cannot win without naming a line to it is refused', () => {
  // Past its first count the second side can no longer win, yet the game
  // names no line where that happens.
  const hopeless = faulty({
    canWin: (position, side) => side === 'white' || position === 'race:0',
  });
  expect(broken(hopeless)).toContain(
    'a side cannot win only where the game names a line to it'
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
  expect(broken(tied)).toContain(
    'its rules draw it only where the game names a line to it'
  );
});
