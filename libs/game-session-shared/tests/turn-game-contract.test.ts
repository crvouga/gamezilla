/**
 * A declared capability is an enforceable promise: `defineTurnGame` refuses
 * an incorrect game at type checking (each `@ts-expect-error` below fails
 * the package's `tc` the day the type accepts it) and, for what a type
 * cannot see (JavaScript, a cast, a widened value), when the game is
 * defined — each refusal saying what to fix.
 */

import { expect, test } from 'bun:test';
import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared/durable-names';
import type {
  TurnGame,
  TurnGameDefinition,
} from '@libs/game-session-shared/turn-game-definition';
import {
  assertTurnGameDefinitions,
  defineTurnGame,
} from '@libs/game-session-shared/turn-game-definition';
import type {
  GameRules,
  TurnGameCapabilities,
} from '@pkgs/turn-game-shared/game-rules';

const rulesOf = (id: string): GameRules => ({
  id,
  recognizes: (position) => position.startsWith(`${id}:`),
  initial: () => `${id}:0`,
  play: () => null,
  replay: () => `${id}:0`,
  legal: () => [],
  canWin: () => true,
  moves: () => [],
});
const notice = {
  timeoutDraw: () => 'Drawn on time.',
  side: (side: string) => side,
  ending: () => undefined,
};
const history = { record: String };
const automation: TurnGame['automation'] = {
  choose: () => null,
  perform: async () => {},
};
const game = (capabilities: TurnGameCapabilities, id = 'race'): TurnGame => ({
  rules: rulesOf(id),
  capabilities,
  automation,
});

/** `capabilities` as JavaScript or a cast hands them over, unchecked. */
const unchecked = (capabilities: object) =>
  capabilities as TurnGameCapabilities;

test('a capability declared without what it needs is refused at type checking', () => {
  const capabilities: TurnGameCapabilities = {
    // @ts-expect-error: custom games need their bots.
    'custom-games': {},
  };
  const matched: TurnGameCapabilities = {
    // @ts-expect-error: finding an opponent needs its notice copy.
    matchmaking: { clockNamespace: 'race/' },
    history,
  };
  void capabilities;
  void matched;
});

test('an unknown capability is refused at type checking and when defined', () => {
  // @ts-expect-error: the platform offers no tournaments.
  const capabilities: TurnGameCapabilities = { tournaments: {} };
  void capabilities;
  expect(() => defineTurnGame(game(unchecked({ tournaments: {} })))).toThrow(
    'race: "tournaments" is not a capability the platform offers (custom-games, matchmaking, history)'
  );
});

test('a placeholder for a capability the game does not offer is refused at type checking and when defined', () => {
  // @ts-expect-error: leave out what the game does not offer.
  const capabilities: TurnGameCapabilities = { history: undefined };
  void capabilities;
  expect(() => defineTurnGame(game(unchecked({ history: undefined })))).toThrow(
    'race: capabilities.history is a placeholder — leave out a capability the game does not offer'
  );
  expect(() => defineTurnGame(game(unchecked({ history: null })))).toThrow(
    'placeholder'
  );
});

test('finding an opponent without history is refused at type checking and when defined', () => {
  // @ts-expect-error: every finished matched game offers its game record.
  const capabilities: TurnGameCapabilities = {
    matchmaking: { clockNamespace: 'race/', notice },
  };
  void capabilities;
  expect(() =>
    defineTurnGame(
      game(unchecked({ matchmaking: { clockNamespace: 'race/', notice } }))
    )
  ).toThrow(
    'race: offering matchmaking needs history too (every finished matched game offers its game record) — add capabilities.history'
  );
  expect(() =>
    defineTurnGame(
      game({ matchmaking: { clockNamespace: 'race/', notice }, history })
    )
  ).not.toThrow();
});

test('only the platform’s durable game keeps the unprefixed clock namespace', () => {
  expect(() =>
    defineTurnGame(
      game({ matchmaking: { clockNamespace: '', notice }, history })
    )
  ).toThrow(
    `race: the unprefixed clock namespace "" belongs to the platform's durable game alone — use "race/"`
  );
  const durable = defineTurnGame(
    game(
      { matchmaking: { clockNamespace: '', notice }, history },
      GAME_PLATFORM_NAMESPACE
    )
  );
  expect(durable.turnGame.unprefixedClockNamespace).toBe(true);
  expect(
    defineTurnGame(
      game({ matchmaking: { clockNamespace: 'race/', notice }, history })
    ).turnGame.unprefixedClockNamespace
  ).toBeUndefined();
});

test('a definition defineTurnGame did not make is refused at type checking and by the registry', () => {
  const defined = defineTurnGame(game({ history }));
  // @ts-expect-error: a copy loses the brand only defineTurnGame gives.
  const copy: TurnGameDefinition = { ...defined };
  const handBuilt = {
    id: 'race',
    turnGame: defined.turnGame,
    automation: defined.automation,
    commandRouters: [],
    eventRouters: [],
    recoverEffects: () => [],
  };
  // @ts-expect-error: a hand-built definition skips the shared sessions.
  const registry: readonly TurnGameDefinition[] = [handBuilt];
  void registry;
  expect(() =>
    assertTurnGameDefinitions('GAME_DEFINITIONS', [defined])
  ).not.toThrow();
  expect(() =>
    assertTurnGameDefinitions('GAME_DEFINITIONS', [defined, copy])
  ).toThrow(
    "GAME_DEFINITIONS[1] (race) was not made by defineTurnGame — register the game's defineTurnGame(...) value itself, never a copy or a hand-built definition"
  );
  expect(() =>
    assertTurnGameDefinitions('GAME_DEFINITIONS', [handBuilt])
  ).toThrow('GAME_DEFINITIONS[0] (race) was not made by defineTurnGame');
});
