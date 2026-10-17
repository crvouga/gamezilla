import { expect, test } from 'bun:test';
import {
  createTurnGames,
  type GameRules,
  requireTurnGames,
} from '@pkgs/turn-game-shared/game-rules';

const game: GameRules = {
  botDifficulties: [],
  id: 'counter',
  recognizes: (position) => position.startsWith('counter:'),
  initial: () => 'counter:0',
  play: () => null,
  replay: () => 'counter:0',
  legal: () => [],
  canWin: () => false,
  choose: () => null,
  moves: () => [],
  record: (position) => position,
};
const notice = {
  timeoutDraw: () => 'drawn on time',
  side: (side: string) => side,
  ending: () => undefined,
};
const registration = (controlPrefix: string, capabilities = ['history']) => ({
  rules: game,
  controlPrefix,
  notice,
  capabilities: capabilities as readonly ('custom-games' | 'history')[],
});
test('rules are explicit and unknown, duplicate or ambiguous registrations fail closed', () => {
  expect(() => requireTurnGames({})).toThrow('inject');
  expect(() =>
    createTurnGames([registration(''), registration('other/')])
  ).toThrow('Duplicate');
  const rules = createTurnGames([registration('counter/')]);
  expect(rules.byId('counter')).toBe(game);
  expect(rules.forPosition('counter:0')).toBe(game);
  expect(rules.forControl('counter/5+0')).toBe(game);
  expect(() => rules.forPosition('unknown:0')).toThrow();
  expect(() => rules.forControl('unregistered/5+0')).toThrow();
});

test('a capability is offered only by a game that declares it', () => {
  const rules = createTurnGames([registration('counter/', ['custom-games'])]);
  expect(rules.offers('counter', 'custom-games')).toBe(true);
  expect(rules.offers('counter', 'matchmaking')).toBe(false);
  expect(rules.offers('unregistered', 'custom-games')).toBe(false);
});
