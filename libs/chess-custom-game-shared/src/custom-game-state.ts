import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import { DEFAULT_POSITION } from 'chess.js';
import { z } from 'zod';

export const CUSTOM_GAME_SIDES = ['white', 'black'] as const;
export type CustomGameSide = (typeof CUSTOM_GAME_SIDES)[number];
export const customGameSideSchema = z.enum(CUSTOM_GAME_SIDES);
export const customGameParticipantSchema = z
  .object({
    kind: z.enum(['person', 'bot', 'invitation', 'open', 'closed']),
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
    ready: z.array(customGameSideSchema),
    minutes: z.number().int().min(0).max(180),
    increment: z.number().int().min(0).max(60),
    revision: z.number().int().nonnegative(),
    startedAt: z.number().int().nonnegative().nullable(),
    endedAt: z.number().int().nonnegative().nullable(),
    turnStartedAt: z.number().int().nonnegative().nullable(),
    remaining: z
      .object({
        white: z.number().nonnegative(),
        black: z.number().nonnegative(),
      })
      .strict(),
    turn: customGameSideSchema,
    fen: z.string().min(1),
    moves: z.array(
      z
        .object({ uci: z.string().min(4).max(5), san: z.string().min(1) })
        .strict()
    ),
    outcome: z.enum([
      '',
      'cancelled',
      'draw',
      'white wins by resignation',
      'black wins by resignation',
      'white wins by checkmate',
      'black wins by checkmate',
      'white wins on time',
      'black wins on time',
      'white wins because black stayed away',
      'black wins because white stayed away',
    ]),
    drawOfferedBy: z.string(),
    /** People whose draw offer was declined and who have not moved since. */
    declinedOffers: z.array(z.string()).default([]),
  })
  .strict();
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
const ns = createAttrNamespace('chess', 'custom');
export const CustomGamesAttr = ns.json('games', parseCustomGames);

export function newCustomGame(id: string, creator: string): CustomGame {
  return {
    id,
    creator,
    status: 'configuring',
    white: { kind: 'person', person: creator },
    black: OPEN_CUSTOM_GAME_SIDE,
    ready: [],
    minutes: 0,
    increment: 0,
    revision: 0,
    startedAt: null,
    endedAt: null,
    turnStartedAt: null,
    remaining: { white: 0, black: 0 },
    turn: 'white',
    fen: DEFAULT_POSITION,
    moves: [],
    outcome: '',
    drawOfferedBy: '',
    declinedOffers: [],
  };
}

export function otherCustomGameSide(side: CustomGameSide): CustomGameSide {
  return side === 'white' ? 'black' : 'white';
}

export function customGamePersonSide(
  game: CustomGame,
  person: string
): CustomGameSide | null {
  return (
    CUSTOM_GAME_SIDES.find(
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
    CUSTOM_GAME_SIDES.every(
      (side) =>
        game[side].kind === 'bot' ||
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
