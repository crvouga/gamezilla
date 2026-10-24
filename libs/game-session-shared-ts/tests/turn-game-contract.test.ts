/**
 * A declared capability is an enforceable promise: `defineTurnGame` refuses
 * an incorrect game at type checking (each `@ts-expect-error` below fails
 * the package's `tc` the day the type accepts it) and, for what a type
 * cannot see (JavaScript, a cast, a widened value), when the game is
 * defined — each refusal saying what to fix.
 */

import { expect, test } from 'bun:test';
import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared-ts/durable-names';
import {
  assertGameDefinitions,
  defineGame,
  type GameRegistration,
} from '@libs/game-session-shared-ts/game-definition';
import type {
  TurnGame,
  TurnGameDefinition,
} from '@libs/game-session-shared-ts/turn-game-definition';
import {
  assertTurnGameDefinitions,
  defineTurnGame,
} from '@libs/game-session-shared-ts/turn-game-definition';
import type { PuzzlesCapability } from '@pkgs/turn-game-shared-ts/game-puzzles';
import type {
  GameRules,
  TurnGameCapabilities,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';

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

const content: PuzzleContent = {
  rules: {
    validateDefinition: () => ({ valid: true }),
    initial: () => ({ accepted: true, state: 'start' }),
    validateState: () => ({ valid: true }),
    apply: () => ({ accepted: true, state: 'end' }),
    complete: (_definition, state) => state === 'end',
  },
};

test('one registry accepts standalone puzzles and a turn game offering authored puzzles', () => {
  const solo = defineGame({ id: 'solo', puzzleContent: content });
  const combined = defineTurnGame({
    ...game({ history }),
    puzzleContent: content,
  });
  expect(() => assertGameDefinitions('games', [solo, combined])).not.toThrow();
  expect('turnGame' in solo).toBe(false);
  expect('automation' in solo).toBe(false);
  expect(solo.puzzleContent).toBe(content);
  expect(combined.puzzleContent).toBe(content);
  expect(combined.sharedModules.map((module) => module.id)).toEqual([
    'turn-game-session',
  ]);
  // @ts-expect-error: copying a definition loses its registration brand.
  const copy: GameRegistration = { ...solo };
  expect(() => assertGameDefinitions('games', [copy])).toThrow(
    'was not made by'
  );
});

test('both constructors refuse incomplete advertised puzzle capabilities', () => {
  const invalid = {
    ...content,
    rules: { ...content.rules, apply: undefined },
  } as unknown as PuzzleContent;
  expect(() => defineGame({ id: 'solo', puzzleContent: invalid })).toThrow(
    'rules.apply'
  );
  expect(() =>
    defineTurnGame({ ...game({ history }), puzzleContent: invalid })
  ).toThrow('rules.apply');
  expect(() =>
    defineGame({ id: 'Not a slug', puzzleContent: content })
  ).toThrow('lowercase slug');
});

// regression: game-registration-implicit-legacy-id
test('legacy namespace authority is explicit and independent of a concrete game id', () => {
  const capabilities = { matchmaking: { clockNamespace: '', notice }, history };
  expect(() =>
    defineTurnGame(game(capabilities, GAME_PLATFORM_NAMESPACE))
  ).toThrow('unprefixed clock namespace');
  const granted = {
    ...game(capabilities, 'independent-legacy'),
    unprefixedNamespace: true as const,
  };
  expect(() => defineTurnGame(granted)).not.toThrow();
});

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
    'race: "tournaments" is not a capability the platform offers (custom-games, matchmaking, history, puzzles)'
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
  const durable = defineTurnGame({
    ...game(
      { matchmaking: { clockNamespace: '', notice }, history },
      GAME_PLATFORM_NAMESPACE
    ),
    unprefixedNamespace: true,
  });
  expect(durable.turnGame.unprefixedNamespace).toBe(true);
  expect(
    defineTurnGame(
      game({ matchmaking: { clockNamespace: 'race/', notice }, history })
    ).turnGame.unprefixedNamespace
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

const puzzles: PuzzlesCapability = {
  namespace: 'race/',
  content: { validate: () => ({ ok: true }) },
  marks: (_position, action) => ({ from: null, to: action }),
  isCell: (cell) => cell.length > 0,
};

test('puzzles declared without what they need are refused at type checking and when defined', () => {
  const { namespace: _namespace, ...withoutNamespace } = puzzles;
  const { marks: _marks, ...withoutMarks } = puzzles;
  const { isCell: _isCell, ...withoutCells } = puzzles;
  const capabilities: readonly TurnGameCapabilities[] = [
    // @ts-expect-error: puzzles need the namespace of their catalogue.
    { puzzles: withoutNamespace },
    // @ts-expect-error: puzzles need the cells an action names.
    { puzzles: withoutMarks },
    // @ts-expect-error: puzzles need to know a board cell.
    { puzzles: withoutCells },
    // @ts-expect-error: puzzles need to accept or refuse a stored record.
    { puzzles: { ...puzzles, content: {} } },
  ];
  void capabilities;
  expect(() =>
    defineTurnGame(game(unchecked({ puzzles: withoutMarks })))
  ).toThrow(
    'race: offering puzzles needs capabilities.puzzles.marks — supply its implementation'
  );
  expect(() =>
    defineTurnGame(game(unchecked({ puzzles: { ...puzzles, content: {} } })))
  ).toThrow(
    'race: offering puzzles needs capabilities.puzzles.content.validate'
  );
  expect(() =>
    defineTurnGame(game(unchecked({ puzzles: withoutNamespace })))
  ).toThrow(
    'race: offering puzzles needs capabilities.puzzles.namespace ("race/")'
  );
});

test('puzzles need no other capability, and only the platform’s durable game keeps the unprefixed puzzle namespace', () => {
  expect(defineTurnGame(game({ puzzles })).turnGame.capabilities.puzzles).toBe(
    puzzles
  );
  expect(() =>
    defineTurnGame(game({ puzzles: { ...puzzles, namespace: '' } }))
  ).toThrow(
    `race: the unprefixed puzzle namespace "" belongs to the platform's durable game alone — use "race/"`
  );
  expect(() =>
    defineTurnGame(game({ puzzles: { ...puzzles, namespace: 'other/' } }))
  ).toThrow('race: puzzle namespace "other/" is not "race/"');
  expect(
    defineTurnGame({
      ...game(
        { puzzles: { ...puzzles, namespace: '' } },
        GAME_PLATFORM_NAMESPACE
      ),
      unprefixedNamespace: true,
    }).turnGame.unprefixedNamespace
  ).toBe(true);
});

// regression: game-capability-missing-implementation
test.each([
  [{ history: {} }, 'history.record'],
  [{ history: { record: 'placeholder' } }, 'history.record'],
  [{ 'custom-games': {} }, 'custom-games.bots.choose'],
  [
    { 'custom-games': { bots: { difficulties: [] } } },
    'custom-games.bots.choose',
  ],
  [
    { matchmaking: { clockNamespace: 'race/' }, history },
    'matchmaking.notice.timeoutDraw',
  ],
  [
    { matchmaking: { clockNamespace: 'race/', notice: {} }, history },
    'matchmaking.notice.timeoutDraw',
  ],
] as const)(
  'an incomplete capability %j fails when defined, naming %s',
  (capabilities, missing) => {
    expect(() => defineTurnGame(game(unchecked(capabilities)))).toThrow(
      `race: offering ${missing.split('.')[0]} needs capabilities.${missing}`
    );
  }
);

test.each([
  { choose: () => null },
  { choose: () => null, difficulties: 'easy' },
  { choose: () => null, difficulties: ['unavailable'] },
])('invalid bot choices %j fail at registration', (bots) => {
  expect(() =>
    defineTurnGame(game(unchecked({ 'custom-games': { bots } })))
  ).toThrow('race: capabilities.custom-games.bots.difficulties');
});
