/**
 * A game's client joins the registry only as `defineGameClient` made it,
 * and with exactly the parts its shared registration asks for: a copy, a
 * hand-built client, a game offering puzzles without a puzzles part, or a
 * puzzles part for a game offering none is refused at type checking (each
 * `@ts-expect-error` fails `tc` the day the type accepts it) and when it
 * is defined or registered, naming what to fix.
 */

import { expect, test } from 'bun:test';
import type {
  GameClient,
  GameClientRegistration,
} from '@libs/game-menu-client-ts/game-client';
import {
  assertGameClientDefinitions,
  defineGameClient,
} from '@libs/game-menu-client-ts/game-client';
import type { GamePuzzlesClient } from '@libs/game-puzzle-client-ts/puzzle-client';
import { defineTurnGame } from '@libs/game-session-shared-ts/turn-game-definition';
import type { PuzzlesCapability } from '@pkgs/turn-game-shared-ts/game-puzzles';
import type { GameRules, GameSide } from '@pkgs/turn-game-shared-ts/game-rules';

/** Count to seven: `step` adds one, and whoever reaches seven wins. */
const rules: GameRules = {
  id: 'race',
  recognizes: (position) => /^race:\d+$/.test(position),
  initial: () => 'race:0',
  play(position, action) {
    const count = Number(position.slice('race:'.length));
    if (action !== 'step' || count >= 7) return null;
    const next = count + 1;
    return {
      position: `race:${String(next)}`,
      history: '',
      turn: next % 2 === 0 ? 'white' : 'black',
      label: String(next),
      winner: next === 7 ? (next % 2 === 1 ? 'white' : 'black') : null,
      reason: next === 7 ? 'finish line' : null,
    };
  },
  replay: () => 'race:0',
  legal: (position) => (position === 'race:7' ? [] : ['step']),
  canWin: () => true,
  moves: () => [],
};
const automation = {
  choose: () => 'step',
  perform: async () => {},
};
const history = { record: (position: string) => position };
const puzzles: PuzzlesCapability = {
  namespace: 'race/',
  content: { validate: () => ({ ok: true }) },
  marks: (_position, action) => ({ from: null, to: action }),
  isCell: (cell) => cell.length > 0,
};
const plain = defineTurnGame({ rules, capabilities: { history }, automation });
const withPuzzles = defineTurnGame({
  rules,
  capabilities: { history, puzzles },
  automation,
});
const puzzlesPart: GamePuzzlesClient = { Board: () => null };

const parts = {
  title: 'Race',
  caption: 'Count to seven first',
  subtitle: () => 'Take turns counting on.',
  presentation: {
    canFlip: false,
    name: () => 'Race',
    Board: () => null,
    sideLabel: (side: GameSide) => (side === 'white' ? 'Hare' : 'Tortoise'),
    endingDescription: () => undefined,
    timeoutDrawDescription: () => 'Drawn on time.',
    endingLabel: () => 'finish line',
  },
};
const client: GameClient = { ...parts, shared: plain };

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

test('a game offering puzzles supplies its puzzles part, at type checking and when defined', () => {
  const defined = defineGameClient({
    ...parts,
    shared: withPuzzles,
    puzzles: puzzlesPart,
  });
  expect(defined.puzzles).toBe(puzzlesPart);
  // @ts-expect-error: the platform's puzzle screens show the game's own board.
  const missing = () => defineGameClient({ ...parts, shared: withPuzzles });
  expect(missing).toThrow(
    'race: the game offers puzzles (capabilities.puzzles) but its client has no puzzles part — give defineGameClient puzzles: { Board, … }'
  );
});

test('a game offering no puzzles has no puzzles part, at type checking and when defined', () => {
  const extra = () =>
    // @ts-expect-error: the platform offers no puzzle screens for this game.
    defineGameClient({ ...parts, shared: plain, puzzles: puzzlesPart });
  expect(extra).toThrow(
    'race: the client has a puzzles part but the game offers no puzzles — add capabilities.puzzles to its defineTurnGame, or leave the part out'
  );
  expect(defineGameClient({ ...parts, shared: plain }).puzzles).toBeUndefined();
});
