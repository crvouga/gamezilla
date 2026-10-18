import { expect, test } from 'bun:test';
import type { PuzzlesCapability } from '@pkgs/turn-game-shared/game-puzzles';
import {
  createTurnGames,
  type GameRules,
  offeredCapabilities,
  type RegisteredTurnGame,
  requireTurnGames,
  type TurnGameCapabilities,
} from '@pkgs/turn-game-shared/game-rules';

const rulesOf = (id: string): GameRules => ({
  id,
  recognizes: (position) => position.startsWith(`${id}:`),
  initial: () => `${id}:0`,
  play: () => null,
  replay: () => `${id}:0`,
  legal: () => [],
  canWin: () => false,
  moves: () => [],
});
const game = rulesOf('counter');
const notice = {
  timeoutDraw: () => 'drawn on time',
  side: (side: string) => side,
  ending: () => undefined,
};
const history = { record: String };
const matchmaking = (clockNamespace: string) => ({ clockNamespace, notice });
const registration = (
  capabilities: TurnGameCapabilities,
  rules: GameRules = game
): RegisteredTurnGame => ({ rules, capabilities });

test('rules are explicit and unknown, duplicate or ambiguous registrations fail closed', () => {
  expect(() => requireTurnGames({})).toThrow('inject');
  expect(() => createTurnGames([registration({}), registration({})])).toThrow(
    'Duplicate'
  );
  const rules = createTurnGames([
    registration({ matchmaking: matchmaking('counter/'), history }),
  ]);
  expect(rules.byId('counter')).toBe(game);
  expect(rules.forPosition('counter:0')).toBe(game);
  expect(rules.forControl('counter/5+0')).toBe(game);
  expect(() => rules.forPosition('unknown:0')).toThrow();
  expect(() => rules.forControl('unregistered/5+0')).toThrow();
});

test('a capability is offered only by a game that supplies it', () => {
  const bots = { difficulties: [], choose: () => null };
  const rules = createTurnGames([registration({ 'custom-games': { bots } })]);
  expect(rules.offers('counter', 'custom-games')).toBe(true);
  expect(rules.capability('counter', 'custom-games')?.bots).toBe(bots);
  expect(rules.offers('counter', 'matchmaking')).toBe(false);
  expect(rules.capability('counter', 'matchmaking')).toBeUndefined();
  expect(rules.offers('unregistered', 'custom-games')).toBe(false);
  expect(offeredCapabilities(rules.games[0]!)).toEqual(['custom-games']);
});

test('a clock choice belongs only to a game offering matchmaking', () => {
  const rules = createTurnGames([registration({ history })]);
  expect(() => rules.forControl('counter/5+0')).toThrow();
});

test('clock namespaces are the game id and never shared', () => {
  expect(() =>
    createTurnGames([
      registration({ matchmaking: matchmaking('other/'), history }),
    ])
  ).toThrow('clock namespace "other/" is not "counter/"');
  const unprefixed = (rules: GameRules): RegisteredTurnGame => ({
    ...registration({ matchmaking: matchmaking(''), history }, rules),
    unprefixedNamespace: true,
  });
  expect(() =>
    createTurnGames([unprefixed(game), unprefixed(rulesOf('second'))])
  ).toThrow('second: clock namespace "" is taken');
});

test('only the game granted it keeps the unprefixed clock namespace', () => {
  expect(() =>
    createTurnGames([registration({ matchmaking: matchmaking(''), history })])
  ).toThrow(
    `counter: the unprefixed clock namespace "" belongs to the platform's durable game alone — use "counter/"`
  );
  const granted = createTurnGames([
    {
      ...registration({ matchmaking: matchmaking(''), history }),
      unprefixedNamespace: true,
    },
  ]);
  expect(granted.forControl('5+0')).toBe(game);
});

test('finding an opponent is refused without history, whose record every matched game offers', () => {
  // A cast stands for JavaScript or a widened value: the type refuses it.
  const capabilities = {
    matchmaking: matchmaking('counter/'),
  } as unknown as TurnGameCapabilities;
  expect(() => createTurnGames([registration(capabilities)])).toThrow(
    'counter: offering matchmaking needs history too (every finished matched game offers its game record) — add capabilities.history'
  );
});

test('a game whose starting position another game claims is refused', () => {
  const greedy: GameRules = { ...rulesOf('greedy'), recognizes: () => true };
  expect(() =>
    createTurnGames([registration({}), registration({}, greedy)])
  ).toThrow('recognized by it alone');
});

const puzzles = (namespace: string): PuzzlesCapability => ({
  namespace,
  content: { validate: () => ({ ok: true }) },
  marks: (_position, action) => ({ from: null, to: action }),
  isCell: (cell) => cell.length > 0,
});

test('puzzles need no other capability, and their namespace is the game id', () => {
  const rules = createTurnGames([
    registration({ puzzles: puzzles('counter/') }),
  ]);
  expect(rules.offers('counter', 'puzzles')).toBe(true);
  expect(offeredCapabilities(rules.games[0]!)).toEqual(['puzzles']);
  expect(() =>
    createTurnGames([registration({ puzzles: puzzles('other/') })])
  ).toThrow('counter: puzzle namespace "other/" is not "counter/"');
});

test('only the game granted it keeps the unprefixed puzzle namespace, and no two games share one', () => {
  expect(() =>
    createTurnGames([registration({ puzzles: puzzles('') })])
  ).toThrow(
    `counter: the unprefixed puzzle namespace "" belongs to the platform's durable game alone — use "counter/"`
  );
  const unprefixed = (rules: GameRules): RegisteredTurnGame => ({
    ...registration({ puzzles: puzzles('') }, rules),
    unprefixedNamespace: true,
  });
  expect(createTurnGames([unprefixed(game)]).offers('counter', 'puzzles')).toBe(
    true
  );
  expect(() =>
    createTurnGames([unprefixed(game), unprefixed(rulesOf('second'))])
  ).toThrow('second: puzzle namespace "" is taken');
});
