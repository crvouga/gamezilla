/**
 * A game's client joins the registry only as `defineGameClient` made it,
 * and with exactly the parts its shared registration asks for: a copy, a
 * hand-built client, a game offering puzzles without a puzzles part, a
 * puzzles part for a game offering none, or a presentation without its
 * frame is refused at type checking (each `@ts-expect-error` fails `tc` the
 * day the type accepts it) and when it is defined or registered, naming
 * what to fix.
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
import { assertGameModes } from '@libs/game-menu-client-ts/game-frame-contract';
import { gameChoices } from '@libs/game-menu-client-ts/game-menu-choices';
import { SHARED_GAME_SCREEN } from '@libs/game-menu-client-ts/shared-game-screens';
import type { GamePuzzlesClient } from '@libs/game-puzzle-client-ts/puzzle-client';
import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import {
  boardOnly,
  fixedPlayers,
  lookOnlySeats,
  standingsFromWinner,
} from '@pkgs/turn-game-shared-ts/game-frame';
import type { PuzzlesCapability } from '@pkgs/turn-game-shared-ts/game-puzzles';
import type {
  GameRules,
  GameSide,
  GameWinner,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';

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
const turnAutomation = {
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
const plain = defineGame({ rules, capabilities: { history }, turnAutomation });
const withPuzzles = defineGame({
  rules,
  capabilities: { history, puzzles },
  turnAutomation,
});
const puzzlesPart: GamePuzzlesClient = { Board: () => null };
const contentFrame = { stats: {}, turnStatus: () => null };

const frame = {
  players: fixedPlayers(2),
  options: [],
  seats: lookOnlySeats((side) => ({ color: side === 'white' ? 1 : 2 })),
  createBoard: boardOnly(() => null),
  turnStatus: () => null,
  result: (_position: string, winner: GameWinner) => ({
    scoreLabel: null,
    standings: standingsFromWinner(winner, ['white', 'black']),
  }),
} as const;

const parts = {
  title: 'Race',
  caption: 'Count to seven first',
  subtitle: () => 'Take turns counting on.',
  presentation: {
    canFlip: false,
    name: () => 'Race',
    Board: () => null,
    sideLabel: (side: GameSide) => (side === 'white' ? 'Hare' : 'Tortoise'),
    frame,
    endingDescription: () => undefined,
    timeoutDrawDescription: () => 'Drawn on time.',
    endingLabel: () => 'finish line',
  },
};
const client: GameClient = { ...parts, shared: plain };

const content: PuzzleContent = {
  rulesVersion: 1,
  rules: {
    validateDefinition: () => ({ valid: true }),
    initial: () => ({ accepted: true, state: rules.initial() }),
    validateState: (_definition, state) =>
      rules.recognizes(state) ? { valid: true } : { valid: false, issues: [] },
    apply: (_definition, state, action) => {
      const change = rules.play(state, action, '', []);
      return change === null
        ? { accepted: false, issues: [] }
        : { accepted: true, state: change.position };
    },
    complete: (_definition, state) => state === 'race:7',
  },
};

test('a puzzle-only client needs its player and no turn-game presentation', () => {
  const shared = defineGame({ id: 'race-puzzle', puzzleContent: content });
  const Player = () => null;
  const defined = defineGameClient({
    shared,
    title: 'Race puzzle',
    caption: 'Reach seven',
    subtitle: () => 'Count on.',
    puzzleContent: { Player, frame: contentFrame },
  });
  expect(defined.presentation).toBeUndefined();
  expect(defined.puzzles).toBeUndefined();
  expect(defined.puzzleContent?.Player).toBe(Player);
  expect(typeof defined.MainMenu).toBe('function');
});

// regression: puzzle-only-menu-reads-turn-rules
test("a puzzle-only game's menu offers its puzzles without reading turn rules", () => {
  const game: GameClient = {
    shared: defineGame({ id: 'race-puzzle', puzzleContent: content }),
    title: 'Race puzzle',
    caption: 'Reach seven',
    subtitle: () => 'Count on.',
    puzzleContent: { Player: () => null, frame: contentFrame },
  };
  expect(gameChoices(game, () => false).map((choice) => choice.screen)).toEqual(
    [SHARED_GAME_SCREEN.content]
  );
});

test('puzzle rendering agrees with standalone and combined registrations', () => {
  const standalone = defineGame({ id: 'race-puzzle', puzzleContent: content });
  expect(() =>
    // @ts-expect-error: a puzzle game always supplies its player.
    defineGameClient({
      shared: standalone,
      title: 'Race puzzle',
      caption: '',
      subtitle: () => '',
    })
  ).toThrow('puzzleContent.Player');
  const combined = defineGame({
    rules,
    capabilities: { history },
    turnAutomation,
    puzzleContent: content,
  });
  // @ts-expect-error: combined games supply their puzzle player too.
  expect(() => defineGameClient({ ...parts, shared: combined })).toThrow(
    'puzzleContent.Player'
  );
  const Player = () => null;
  expect(
    defineGameClient({
      ...parts,
      shared: combined,
      puzzleContent: { Player, frame: contentFrame },
    }).puzzleContent?.Player
  ).toBe(Player);
  expect(() =>
    defineGameClient({
      ...parts,
      shared: plain,
      // @ts-expect-error: a game without puzzle content cannot render its player.
      puzzleContent: { Player, frame: contentFrame },
    })
  ).toThrow('offers no puzzle content');
});

test('a timed matchmaking presentation needs its timeout description', () => {
  const { timeoutDrawDescription: _dropped, ...presentation } =
    parts.presentation;
  const shared = defineGame({
    rules,
    turnAutomation,
    capabilities: {
      history,
      matchmaking: {
        namespace: 'race/',
        clockChoices: true,
        notice: {
          side: (side) => side,
          ending: () => undefined,
          timeoutDraw: () => 'Drawn on time.',
        },
      },
    },
  });
  expect(() =>
    defineGameClient({ ...parts, shared, presentation } as GameClient)
  ).toThrow('clock choices need presentation.timeoutDrawDescription');
});

test('a presentation without turn clocks has no timeout-copy obligation', () => {
  const { timeoutDrawDescription: _dropped, ...presentation } =
    parts.presentation;
  expect(() =>
    defineGameClient({ ...parts, shared: plain, presentation })
  ).not.toThrow();
});

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
    'race: the client has a puzzles part but the game offers no puzzles — add capabilities.puzzles to its defineGame, or leave the part out'
  );
  expect(defineGameClient({ ...parts, shared: plain }).puzzles).toBeUndefined();
});

test('a presentation or puzzle content without its frame is refused at type checking and when defined', () => {
  const { frame: _dropped, ...partial } = parts.presentation;
  expect(() =>
    // @ts-expect-error: the shared frame shows every game from its frame.
    defineGameClient({ ...parts, shared: plain, presentation: partial })
  ).toThrow('race: its presentation has no frame');
  const shared = defineGame({ id: 'race-puzzle', puzzleContent: content });
  expect(() =>
    defineGameClient({
      shared,
      title: 'Race puzzle',
      caption: '',
      subtitle: () => '',
      // @ts-expect-error: the solo frame labels the content's figures.
      puzzleContent: { Player: () => null },
    })
  ).toThrow('race-puzzle: puzzleContent.frame needs its turnStatus');
});

/** The race's client with `change` made to its frame. */
const withFrame = (change: Partial<typeof frame> | Record<string, unknown>) =>
  defineGameClient({
    ...parts,
    shared: plain,
    presentation: { ...parts.presentation, frame: { ...frame, ...change } },
  } as GameClient);

test('a frame seats exactly as many as its rules', () => {
  expect(() => withFrame({ players: fixedPlayers(3) })).toThrow(
    'race: frame.players.default is 3, but its rules seat 2'
  );
  expect(() => withFrame({ players: { min: 2, max: 5, default: 2 } })).toThrow(
    'race: frame.players.max is 5, but a game seats at most 4'
  );
  expect(() => withFrame({ players: { min: 3, max: 4, default: 2 } })).toThrow(
    'race: frame.players needs min ≤ default ≤ max'
  );
});

test('a frame offering other player counts names a mode for each', () => {
  expect(() => withFrame({ players: { min: 2, max: 3, default: 2 } })).toThrow(
    'race: frame.players offers 3 players but names no mode for them'
  );
  expect(() =>
    withFrame({
      players: { min: 2, max: 3, default: 2, modes: { 2: 'other', 3: 'x' } },
    })
  ).toThrow('race: frame.players.modes names other for its own count, 2');
  expect(() =>
    withFrame({
      players: { min: 2, max: 3, default: 2, modes: { 2: 'race', 3: 'x' } },
    })
  ).not.toThrow();
});

test('the registry lists every mode a frame names, of the same family', () => {
  const defined = withFrame({
    players: { min: 2, max: 3, default: 2, modes: { 2: 'race', 3: 'race-3' } },
  });
  expect(() => assertGameModes('GAME_CLIENT_DEFINITIONS', [defined])).toThrow(
    'GAME_CLIENT_DEFINITIONS: race names race-3 for 3 players, which is not listed'
  );
  expect(() =>
    assertGameModes('GAME_CLIENT_DEFINITIONS', [defineGameClient(client)])
  ).not.toThrow();
});

test("a frame's options are ones its rules apply, and its seats look apart", () => {
  const option = {
    kind: 'count',
    id: 'target',
    label: () => 'Target',
    min: 1,
    max: 9,
    default: 7,
    read: () => 7,
    encode: String,
  } as const;
  expect(() => withFrame({ options: [option] })).toThrow(
    'race: frame option target needs rules.configuration to apply it before play'
  );
  expect(() => withFrame({ options: [{ ...option, default: 10 }] })).toThrow(
    'race: frame option target needs whole numbers min ≤ default ≤ max'
  );
  expect(() =>
    withFrame({ seats: lookOnlySeats(() => ({ color: 1 })) })
  ).toThrow('race: two seats share one look');
});
