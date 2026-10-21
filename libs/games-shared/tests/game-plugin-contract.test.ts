import { describe, expect, test } from 'bun:test';
import { assertGameNamespaceOwner } from '@libs/games-shared/game-namespace-owner';

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
  test('composition reserves legacy namespaces for its one designated definition', () => {
    const owner = {
      id: 'legacy',
      turnGame: { unprefixedNamespace: true as const },
    };
    const other = { id: 'other', turnGame: {} };
    expect(() => assertGameNamespaceOwner([owner, other], owner)).not.toThrow();
    expect(() =>
      assertGameNamespaceOwner(
        [owner, { ...other, turnGame: { unprefixedNamespace: true } }],
        owner
      )
    ).toThrow('"other" claims the unprefixed namespace owned by "legacy"');
    expect(() => assertGameNamespaceOwner([{ ...owner }], owner)).toThrow(
      'claims the unprefixed namespace'
    );
  });
  test('the space module composes an additional game without product changes', () => {
    const games = [dummyGame('first'), dummyGame('second')];
    const module = composeSpaceRoomModule(games, {
      now: () => 0,
      random: () => 0,
      authority: true,
    });
    const again = composeSpaceRoomModule([...games], {
      now: () => 0,
      random: () => 0,
      authority: true,
    });
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
      'game registry: client "c" has no turn game — register its defineTurnGame(...) value in GAME_DEFINITIONS, or give its defineGameClient the shared definition of the game it shows'
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

  test('a client has a puzzles part exactly when its game offers puzzles, saying which entry to fix', () => {
    const offering = {
      id: 'a',
      turnGame: { capabilities: { puzzles: { namespace: 'a/' } } },
    };
    const part = { Board: () => null };
    expect(() =>
      assertMatchingGameIds([offering], [{ id: 'a', puzzles: part }])
    ).not.toThrow();
    expect(() => assertMatchingGameIds([offering], [{ id: 'a' }])).toThrow(
      'game registry: "a" offers puzzles but GAME_CLIENT_DEFINITIONS[0] has no puzzles part — give its defineGameClient a puzzles part (its board), made with this definition as its shared'
    );
    expect(() =>
      assertMatchingGameIds([dummyGame('a')], [{ id: 'a', puzzles: part }])
    ).toThrow(
      'game registry: GAME_CLIENT_DEFINITIONS[0] ("a") has a puzzles part but GAME_DEFINITIONS[0] offers no puzzles — register the definition its client was made with'
    );
  });
});
