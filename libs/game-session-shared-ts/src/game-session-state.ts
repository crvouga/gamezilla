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

export const GAME_SESSION_SIDES = GAME_SIDES;
export type GameSessionSide = (typeof GAME_SESSION_SIDES)[number];
export const gameSessionSideSchema = z.enum(GAME_SESSION_SIDES);
export const gameSessionParticipantSchema = z
  .object({
    kind: z.enum(['person', 'bot', 'local', 'invitation', 'open', 'closed']),
    person: z.string(),
  })
  .strict()
  .refine(
    (p) =>
      (p.kind === 'person' || p.kind === 'invitation') === p.person.length > 0
  );
export type GameSessionParticipant = z.infer<
  typeof gameSessionParticipantSchema
>;
export const OPEN_GAME_SESSION_SIDE: GameSessionParticipant = {
  kind: 'open',
  person: '',
};
export const BOT_GAME_SESSION_SIDE: GameSessionParticipant = {
  kind: 'bot',
  person: '',
};
export const LOCAL_GAME_SESSION_SIDE: GameSessionParticipant = {
  kind: 'local',
  person: '',
};
export const CLOSED_GAME_SESSION_SIDE: GameSessionParticipant = {
  kind: 'closed',
  person: '',
};

/**
 * Who the game is with. A game against people and a game against bots are
 * different products: each has its own setup and its own play screen.
 * Older saved games are classified by their occupied seats.
 */
export const PLAY_MODES = ['vs-human', 'vs-bot'] as const;
export type PlayMode = (typeof PLAY_MODES)[number];

export const gameSessionSchema = z
  .object({
    id: z.string().min(1),
    creator: z.string().min(1),
    mode: z.enum(PLAY_MODES).optional(),
    status: z.enum(['configuring', 'active', 'completed', 'cancelled']),
    white: gameSessionParticipantSchema,
    black: gameSessionParticipantSchema,
    red: gameSessionParticipantSchema.default(CLOSED_GAME_SESSION_SIDE),
    blue: gameSessionParticipantSchema.default(CLOSED_GAME_SESSION_SIDE),
    sides: z
      .array(gameSessionSideSchema)
      .refine(
        (sides) =>
          sides.length >= 2 &&
          sides.every((side, index) => side === GAME_SIDES[index])
      )
      .default(['white', 'black']),
    ready: z.array(gameSessionSideSchema),
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
    turn: gameSessionSideSchema,
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
    /**
     * In a phase of private commitments: the sides still to commit and the
     * sides that have (which everyone sees; what they chose stays private).
     */
    awaiting: z.array(gameSessionSideSchema).default([]),
    committed: z.array(gameSessionSideSchema).default([]),
    /** Sides of people away past the grace period, played by a disclosed stand-in bot. */
    standIns: z.array(gameSessionSideSchema).default([]),
  })
  .strict()
  .refine(
    (game) =>
      game.sides.includes(game.turn) &&
      [...game.ready, ...game.awaiting, ...game.committed].every((side) =>
        game.sides.includes(side)
      ) &&
      game.awaiting.every((side) => !game.committed.includes(side)) &&
      game.standIns.every((side) => game[side].kind === 'person')
  )
  .refine((game) =>
    GAME_SESSION_SIDES.every(
      (side) => game.sides.includes(side) || game[side].kind === 'closed'
    )
  )
  .transform((game) => ({
    ...game,
    mode:
      game.mode ??
      (game.sides.some((side) => game[side].kind === 'bot') &&
      game.sides.every(
        (side) =>
          game[side].kind === 'bot' || game[side].person === game.creator
      )
        ? 'vs-bot'
        : 'vs-human'),
  }));
export type GameSession = z.infer<typeof gameSessionSchema>;
export const gameSessionsSchema = z
  .object({
    current: gameSessionSchema.nullable(),
    history: z.array(gameSessionSchema),
  })
  .strict();
export type GameSessions = z.infer<typeof gameSessionsSchema>;
export const EMPTY_GAME_SESSIONS: GameSessions = { current: null, history: [] };

/**
 * Parsed game sessions by the stored value they came from. Room state is
 * immutable, so a value parsed once parses the same every time it is read:
 * a long game (every card of a Hearts game) is validated once per change,
 * not once per read.
 */
const PARSED = new WeakMap<object, GameSessions>();

function parseGameSessions(value: unknown): GameSessions {
  if (value === undefined) return EMPTY_GAME_SESSIONS;
  if (typeof value === 'object' && value !== null) {
    const known = PARSED.get(value);
    if (known !== undefined) return known;
  }
  const parsed = gameSessionsSchema.parse(value);
  if (typeof value === 'object' && value !== null) PARSED.set(value, parsed);
  PARSED.set(parsed, parsed);
  return parsed;
}
const ns = createAttrNamespace(GAME_PLATFORM_NAMESPACE, 'custom');
export const GameSessionsAttr = ns.json('games', parseGameSessions);

/** A bot's strength until someone chooses one (a game with one bot ignores it). */
export const DEFAULT_BOT_DIFFICULTY = 'medium' satisfies BotDifficulty;
export function newGameSession(options: {
  id: string;
  creator: string;
  position: string;
  sides?: readonly GameSide[];
  mode?: PlayMode;
}): GameSession {
  const {
    id,
    creator,
    position,
    sides = ['white', 'black'],
    mode = 'vs-human',
  } = options;
  assertGameSides({ id: 'play-game', sides });
  const opponent =
    mode === 'vs-bot' ? BOT_GAME_SESSION_SIDE : OPEN_GAME_SESSION_SIDE;
  return {
    id,
    creator,
    mode,
    status: 'configuring',
    white: { kind: 'person', person: creator },
    black: opponent,
    red: sides.includes('red') ? opponent : CLOSED_GAME_SESSION_SIDE,
    blue: sides.includes('blue') ? opponent : CLOSED_GAME_SESSION_SIDE,
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
    awaiting: [],
    committed: [],
    standIns: [],
  };
}

export function otherGameSessionSide(side: GameSessionSide): GameSessionSide {
  return requireTwoPlayerSide(side) === 'white' ? 'black' : 'white';
}

export function gameSessionPersonSide(
  game: GameSession,
  person: string
): GameSessionSide | null {
  return (
    game.sides.find(
      (side) => game[side].kind === 'person' && game[side].person === person
    ) ?? null
  );
}

/** Whether `person` takes part in a space's current, active Game Session. */
export function gameSessionActiveParticipant(
  games: GameSessions,
  person: string
): boolean {
  const game = games.current;
  return (
    game !== null &&
    game.status === 'active' &&
    gameSessionPersonSide(game, person) !== null
  );
}

/** The menu row that starts a game against people. */
export const VS_HUMAN_SCREEN = 'vs-human';
/** The menu row that starts a game against bots. */
export const VS_BOT_SCREEN = 'vs-bot';

/** Whether a game session is under way in the space. */
export function gameSessionUnderWay(games: GameSessions): boolean {
  return games.current?.status === 'active';
}

export function gameSessionTerminal(game: GameSession): boolean {
  return game.status === 'completed' || game.status === 'cancelled';
}

export function gameSessionStartable(game: GameSession): boolean {
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

/** Whether a bot plays `side` now: a bot's side, or a person's stand-in. */
export function gameSessionBotPlays(
  game: GameSession,
  side: GameSessionSide
): boolean {
  return game[side].kind === 'bot' || game.standIns.includes(side);
}

/** Whether the game waits for private commitments rather than a turn. */
export function gameSessionCommitting(game: GameSession): boolean {
  return game.status === 'active' && game.awaiting.length > 0;
}

/** The clock of the side to move runs only while play is by turns. */
export function gameSessionTimeLeft(
  game: GameSession,
  side: GameSessionSide,
  now: number
): number {
  const elapsed =
    game.status === 'active' &&
    !gameSessionCommitting(game) &&
    game.turn === side &&
    game.turnStartedAt !== null
      ? Math.max(0, now - game.turnStartedAt)
      : 0;
  return Math.max(0, game.remaining[side] - elapsed);
}

/** All clocks frozen at the same instant, including currently inactive seats. */
export function gameSessionRemaining(
  game: GameSession,
  now: number
): GameSession['remaining'] {
  return {
    white: gameSessionTimeLeft(game, 'white', now),
    black: gameSessionTimeLeft(game, 'black', now),
    red: gameSessionTimeLeft(game, 'red', now),
    blue: gameSessionTimeLeft(game, 'blue', now),
  };
}

/** Rotate seats in their declared turn order for a swap or rematch. */
export function rotatedGameSessionSide(
  game: GameSession,
  side: GameSessionSide
): GameSessionSide {
  return game.sides[
    (game.sides.indexOf(side) + game.sides.length - 1) % game.sides.length
  ]!;
}
