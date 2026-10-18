/**
 * A game's client joins the registry only as `defineGameClient` made it:
 * a copy or a hand-built client is refused at type checking (each
 * `@ts-expect-error` fails `tc` the day the type accepts it) and by the
 * registry's check, which names the entry to fix.
 */

import { expect, test } from 'bun:test';
import type {
  GameClient,
  GameClientRegistration,
} from '@libs/game-menu-client/game-client';
import {
  assertGameClientDefinitions,
  defineGameClient,
} from '@libs/game-menu-client/game-client';

const client: GameClient = {
  id: 'race',
  title: 'Race',
  caption: 'Count to seven first',
  subtitle: () => 'Take turns counting on.',
  presentation: {
    canFlip: false,
    name: () => 'Race',
    Board: () => null,
    sideLabel: (side) => (side === 'white' ? 'Hare' : 'Tortoise'),
    endingDescription: () => undefined,
    timeoutDrawDescription: () => 'Drawn on time.',
    endingLabel: () => 'finish line',
  },
};

test('a presentation without its ending copy is refused at type checking', () => {
  const { endingDescription: _dropped, ...partial } = client.presentation;
  // @ts-expect-error: the shared screens describe every ending through it.
  const incomplete: GameClient = { ...client, presentation: partial };
  void incomplete;
});

test('a client defineGameClient did not make is refused at type checking and by the registry', () => {
  const defined = defineGameClient(client);
  expect(defined.presentation.id).toBe('race');
  // @ts-expect-error: a copy loses the brand only defineGameClient gives.
  const copy: GameClientRegistration = { ...defined };
  const handBuilt = {
    id: 'race',
    title: 'Race',
    MainMenu: () => null,
    presentation: defined.presentation,
  };
  // @ts-expect-error: a hand-built client skips the game menu and its checks.
  const registry: readonly GameClientRegistration[] = [handBuilt];
  void registry;
  expect(() =>
    assertGameClientDefinitions('GAME_CLIENT_DEFINITIONS', [defined])
  ).not.toThrow();
  expect(() =>
    assertGameClientDefinitions('GAME_CLIENT_DEFINITIONS', [defined, copy])
  ).toThrow(
    "GAME_CLIENT_DEFINITIONS[1] (race) was not made by defineGameClient — register the game's defineGameClient(...) value itself, never a copy or a hand-built client"
  );
  expect(() =>
    assertGameClientDefinitions('GAME_CLIENT_DEFINITIONS', [handBuilt])
  ).toThrow(
    'GAME_CLIENT_DEFINITIONS[0] (race) was not made by defineGameClient'
  );
});
