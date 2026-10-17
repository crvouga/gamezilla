import { expect, test } from 'bun:test';
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
    registration({ matchmaking: matchmaking('counter/') }),
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
  const rules = createTurnGames([
    registration({ history: { record: String } }),
  ]);
  expect(() => rules.forControl('counter/5+0')).toThrow();
});

test('clock namespaces are the game id and never shared', () => {
  expect(() =>
    createTurnGames([registration({ matchmaking: matchmaking('other/') })])
  ).toThrow('is not "counter/"');
  expect(() =>
    createTurnGames([
      registration({ matchmaking: matchmaking('') }),
      registration({ matchmaking: matchmaking('') }, rulesOf('second')),
    ])
  ).toThrow('is taken');
});

test('a game whose starting position another game claims is refused', () => {
  const greedy: GameRules = { ...rulesOf('greedy'), recognizes: () => true };
  expect(() =>
    createTurnGames([registration({}), registration({}, greedy)])
  ).toThrow('recognized by it alone');
});
