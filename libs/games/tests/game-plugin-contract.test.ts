import { describe, expect, test } from 'bun:test';

import type { GameDefinition } from '@libs/spaces/public/game';
import {
  assertGameRegistry,
  assertMatchingGameIds,
  composeSpaceRoomModule,
} from '@libs/spaces/public/load-game-plugins';

/** A game with no routers: the thinnest definition the registry accepts. */
function dummyGame(id: string): GameDefinition {
  return { id, commandRouters: [], eventRouters: [] };
}

describe('game plugin contract', () => {
  test('the space module composes an additional game without product changes', () => {
    const games = [dummyGame('first'), dummyGame('second')];
    const module = composeSpaceRoomModule(games, () => 0);
    const again = composeSpaceRoomModule([...games], () => 0);
    expect(again.name).toBe(module.name);
    expect(module.initialState()).toBeDefined();
  });

  test('duplicate game ids are rejected at the composition root', () => {
    expect(() =>
      assertGameRegistry([dummyGame('dup'), dummyGame('dup')])
    ).toThrow('duplicate game id dup');
    expect(() =>
      assertGameRegistry([dummyGame('a'), dummyGame('b')])
    ).not.toThrow();
  });

  test('shared and client registries must line up by id', () => {
    expect(() =>
      assertMatchingGameIds(
        [dummyGame('a'), dummyGame('b')],
        [dummyGame('a'), dummyGame('b')]
      )
    ).not.toThrow();
    expect(() =>
      assertMatchingGameIds([dummyGame('a'), dummyGame('b')], [dummyGame('a')])
    ).toThrow('length mismatch');
    expect(() =>
      assertMatchingGameIds([dummyGame('a')], [dummyGame('b')])
    ).toThrow('does not match client id');
  });
});
