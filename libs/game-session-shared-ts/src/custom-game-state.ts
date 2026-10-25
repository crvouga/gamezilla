import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared-ts/durable-names';
import { simulationExecutionSchema } from '@libs/game-matchmaking-shared-ts/simulation-execution';
import { createAttrNamespace } from '@pkgs/attribute-shared-ts/attribute';
import {
  assertGameSides,
  type BotDifficulty,
  GAME_SIDES,
  type GameSide,
  requireTwoPlayerSide,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { z } from 'zod';

export const CUSTOM_GAME_SIDES = GAME_SIDES;
export type CustomGameSide = (typeof CUSTOM_GAME_SIDES)[number];
export const customGameSideSchema = z.enum(CUSTOM_GAME_SIDES);
export const customGameParticipantSchema = z
  .object({
    kind: z.enum(['person', 'bot', 'local', 'invitation', 'open', 'closed']),
    person: z.string(),
  })
  .strict()
  .refine(
    (p) =>
      (p.kind === 'person' || p.kind === 'invitation') === p.person.length > 0
  );
export type CustomGameParticipant = z.infer<typeof customGameParticipantSchema>;
export const OPEN_CUSTOM_GAME_SIDE: CustomGameParticipant = {
  kind: 'open',
  person: '',
};
export const BOT_CUSTOM_GAME_SIDE: CustomGameParticipant = {
  kind: 'bot',
  person: '',
};
export const LOCAL_CUSTOM_GAME_SIDE: CustomGameParticipant = {
  kind: 'local',
  person: '',
};
export const CLOSED_CUSTOM_GAME_SIDE: CustomGameParticipant = {
  kind: 'closed',
  person: '',
};

export const customGameSchema = z
  .object({
    id: z.string().min(1),
    creator: z.string().min(1),
    status: z.enum(['configuring', 'active', 'completed', 'cancelled']),
    white: customGameParticipantSchema,
    black: customGameParticipantSchema,
    red: customGameParticipantSchema.default(CLOSED_CUSTOM_GAME_SIDE),
    blue: customGameParticipantSchema.default(CLOSED_CUSTOM_GAME_SIDE),
    sides: z
      .array(customGameSideSchema)
      .refine(
        (sides) =>
          sides.length >= 2 &&
          sides.every((side, index) => side === GAME_SIDES[index])
      )
      .default(['white', 'black']),
    ready: z.array(customGameSideSchema),
    minutes: z.number().int().min(0).max(180),
    increment: z.number().int().min(0).max(60),
    difficulty: z
      .object({
        white: z.enum(['easy', 'medium', 'hard']),
        black: z.enum(['easy', 'medium', 'hard']),
        red: z.enum(['easy', 'medium', 'hard']).default('medium'),
        blue: z.enum(['easy', 'medium', 'hard']).default('medium'),
      })
      .default({
        white: 'medium',
        black: 'medium',
        red: 'medium',
        blue: 'medium',
      }),
    revision: z.number().int().nonnegative(),
    /** Present only for a game with fixed-step execution; ticks are not a move log. */
    execution: simulationExecutionSchema.optional(),
    startedAt: z.number().int().nonnegative().nullable(),
    endedAt: z.number().int().nonnegative().nullable(),
    turnStartedAt: z.number().int().nonnegative().nullable(),
    remaining: z
      .object({
        white: z.number().nonnegative(),
        black: z.number().nonnegative(),
        red: z.number().nonnegative().default(0),
        blue: z.number().nonnegative().default(0),
      })
      .strict(),
    turn: customGameSideSchema,
    fen: z.string().min(1),
    moves: z.array(
      z
        .object({ uci: z.string().min(1).max(256), san: z.string().min(1) })
        .strict()
    ),
    outcome: z.string(),
    outcomeReason: z.string().default(''),
    drawAcceptedBy: z.array(z.string()).default([]),
    drawOfferedBy: z.string(),
    /** People whose draw offer was declined and who have not moved since. */
    declinedOffers: z.array(z.string()).default([]),
  })
  .strict()
  .refine(
    (game) =>
      game.sides.includes(game.turn) &&
      game.ready.every((side) => game.sides.includes(side))
  )
  .refine((game) =>
    CUSTOM_GAME_SIDES.every(
      (side) => game.sides.includes(side) || game[side].kind === 'closed'
    )
  );
export type CustomGame = z.infer<typeof customGameSchema>;
export const customGamesSchema = z
  .object({
    current: customGameSchema.nullable(),
    history: z.array(customGameSchema),
  })
  .strict();
export type CustomGames = z.infer<typeof customGamesSchema>;
export const EMPTY_CUSTOM_GAMES: CustomGames = { current: null, history: [] };

function parseCustomGames(value: unknown): CustomGames {
  return value === undefined
    ? EMPTY_CUSTOM_GAMES
    : customGamesSchema.parse(value);
}
const ns = createAttrNamespace(GAME_PLATFORM_NAMESPACE, 'custom');
export const CustomGamesAttr = ns.json('games', parseCustomGames);

/** A bot's strength until someone chooses one (a game with one bot ignores it). */
export const DEFAULT_BOT_DIFFICULTY = 'medium' satisfies BotDifficulty;
export function newCustomGame(
  id: string,
  creator: string,
  position: string,
  sides: readonly GameSide[] = ['white', 'black']
): CustomGame {
  assertGameSides({ id: 'custom-game', sides });
  return {
    id,
    creator,
    status: 'configuring',
    white: { kind: 'person', person: creator },
    black: OPEN_CUSTOM_GAME_SIDE,
    red: sides.includes('red')
      ? OPEN_CUSTOM_GAME_SIDE
      : CLOSED_CUSTOM_GAME_SIDE,
    blue: sides.includes('blue')
      ? OPEN_CUSTOM_GAME_SIDE
      : CLOSED_CUSTOM_GAME_SIDE,
    sides: [...sides],
    ready: [],
    minutes: 0,
    increment: 0,
    difficulty: {
      white: DEFAULT_BOT_DIFFICULTY,
      black: DEFAULT_BOT_DIFFICULTY,
      red: DEFAULT_BOT_DIFFICULTY,
      blue: DEFAULT_BOT_DIFFICULTY,
    },
    revision: 0,
    startedAt: null,
    endedAt: null,
    turnStartedAt: null,
    remaining: { white: 0, black: 0, red: 0, blue: 0 },
    turn: 'white',
    fen: position,
    moves: [],
    outcome: '',
    outcomeReason: '',
    drawAcceptedBy: [],
    drawOfferedBy: '',
    declinedOffers: [],
  };
}

export function otherCustomGameSide(side: CustomGameSide): CustomGameSide {
  return requireTwoPlayerSide(side) === 'white' ? 'black' : 'white';
}

export function customGamePersonSide(
  game: CustomGame,
  person: string
): CustomGameSide | null {
  return (
    game.sides.find(
      (side) => game[side].kind === 'person' && game[side].person === person
    ) ?? null
  );
}

/** Whether `person` takes part in a space's current, active Custom Game. */
export function customGameActiveParticipant(
  games: CustomGames,
  person: string
): boolean {
  const game = games.current;
  return (
    game !== null &&
    game.status === 'active' &&
    customGamePersonSide(game, person) !== null
  );
}

export function customGameTerminal(game: CustomGame): boolean {
  return game.status === 'completed' || game.status === 'cancelled';
}

export function customGameStartable(game: CustomGame): boolean {
  return (
    game.status === 'configuring' &&
    game.sides.every(
      (side) =>
        game[side].kind === 'bot' ||
        game[side].kind === 'local' ||
        (game[side].kind === 'person' && game.ready.includes(side))
    )
  );
}

export function customGameTimeLeft(
  game: CustomGame,
  side: CustomGameSide,
  now: number
): number {
  const elapsed =
    game.status === 'active' &&
    game.turn === side &&
    game.turnStartedAt !== null
      ? Math.max(0, now - game.turnStartedAt)
      : 0;
  return Math.max(0, game.remaining[side] - elapsed);
}

/** All clocks frozen at the same instant, including currently inactive seats. */
export function customGameRemaining(
  game: CustomGame,
  now: number
): CustomGame['remaining'] {
  return {
    white: customGameTimeLeft(game, 'white', now),
    black: customGameTimeLeft(game, 'black', now),
    red: customGameTimeLeft(game, 'red', now),
    blue: customGameTimeLeft(game, 'blue', now),
  };
}

/** Rotate seats in their declared turn order for a swap or rematch. */
export function rotatedCustomGameSide(
  game: CustomGame,
  side: CustomGameSide
): CustomGameSide {
  return game.sides[
    (game.sides.indexOf(side) + game.sides.length - 1) % game.sides.length
  ]!;
}
