import { describe, expect, test } from 'bun:test';

import type { GameDefinition } from '@libs/spaces-shared/game';
import {
  assertGameRegistry,
  assertMatchingGameIds,
  composeSpaceRoomModule,
} from '@libs/spaces-shared/load-game-plugins';

/** A game with no routers: the thinnest definition the registry accepts. */
function dummyGame(id: string): GameDefinition {
  return { id, commandRouters: [], eventRouters: [], recoverEffects: () => [] };
}

describe('game plugin contract', () => {
  test('the space module composes an additional game without product changes', () => {
    const games = [dummyGame('first'), dummyGame('second')];
    const module = composeSpaceRoomModule(
      games,
      () => 0,
      () => 0
    );
    const again = composeSpaceRoomModule(
      [...games],
      () => 0,
      () => 0
    );
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

  test('shared and client registries must line up by id, saying which entry to fix', () => {
    expect(() =>
      assertMatchingGameIds(
        [dummyGame('a'), dummyGame('b')],
        [dummyGame('a'), dummyGame('b')]
      )
    ).not.toThrow();
    expect(() =>
      assertMatchingGameIds([dummyGame('a'), dummyGame('b')], [dummyGame('a')])
    ).toThrow(
      'game registry: "b" is in GAME_DEFINITIONS but has no client — add its defineGameClient(...) value to GAME_CLIENT_DEFINITIONS at index 1'
    );
    expect(() =>
      assertMatchingGameIds([dummyGame('a')], [dummyGame('a'), dummyGame('c')])
    ).toThrow(
      'game registry: client "c" has no turn game — register its defineTurnGame(...) value in GAME_DEFINITIONS, or give defineGameClient the id of the game it shows'
    );
    expect(() =>
      assertMatchingGameIds(
        [dummyGame('a'), dummyGame('b')],
        [dummyGame('b'), dummyGame('a')]
      )
    ).toThrow(
      'game registry: GAME_CLIENT_DEFINITIONS[0] is "b" but GAME_DEFINITIONS[0] is "a" — list the clients in the order of GAME_DEFINITIONS'
    );
  });
});
