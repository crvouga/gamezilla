import {
  createMessageNamespace,
  type Message,
} from '@pkgs/message-shared-ts/message';
import { z } from 'zod';
import { gameSessionAbsenceSchema } from './game-session-absence';
import type { GameSessionChoice } from './game-session-choice';
import { gameSessionChoiceSchema } from './game-session-choice';
import {
  gameSessionSchema,
  gameSessionSideSchema,
  gameSessionsSchema,
} from './game-session-state';

export const gameSessionCmdNs = createMessageNamespace('chess-custom-cmd');
export const ChangeGameSession = gameSessionCmdNs(
  'change',
  (p): p is GameSessionChoice => gameSessionChoiceSchema.safeParse(p).success
);

const localChangeSchema = z
  .object({
    choice: gameSessionChoiceSchema,
    at: z.number().int().nonnegative(),
    /**
     * The draws a solo game with dealt hands deals from, drawn once on the
     * creator's device, so every copy deals the same hands.
     */
    draws: z.array(z.number().min(0).lt(1)).max(64).optional(),
  })
  .strict();
export type ChangeLocalGameSessionPayload = z.infer<typeof localChangeSchema>;
export const ChangeLocalGameSession = gameSessionCmdNs(
  'local-change',
  (p): p is ChangeLocalGameSessionPayload =>
    localChangeSchema.safeParse(p).success
);

const wakeSchema = z
  .object({
    gameId: z.string().min(1),
    ply: z.number().int().nonnegative(),
    side: gameSessionSideSchema,
  })
  .strict();
export type GameSessionWake = z.infer<typeof wakeSchema>;
const localWakeSchema = wakeSchema.extend({
  at: z.number().int().nonnegative(),
});
const botMoveSchema = localWakeSchema.extend({
  move: z.string().min(1).max(256),
});
export type GameSessionBotWake =
  | GameSessionWake
  | z.infer<typeof botMoveSchema>;
export const PlayGameSessionBot = gameSessionCmdNs(
  'bot-turn',
  (p): p is GameSessionBotWake =>
    z.union([wakeSchema, botMoveSchema]).safeParse(p).success
);
export const EndLocalGameSessionOnTime = gameSessionCmdNs(
  'local-time-up',
  (p): p is z.infer<typeof localWakeSchema> =>
    localWakeSchema.safeParse(p).success
);
/** The room's wake once an away participant's grace period may have passed. */
export const StandInGameSession = gameSessionCmdNs(
  'stand-in',
  (p): p is { readonly gameId: string } =>
    z
      .object({ gameId: z.string().min(1) })
      .strict()
      .safeParse(p).success
);
export const EndGameSessionOnTime = gameSessionCmdNs(
  'time-up',
  (p): p is GameSessionWake => wakeSchema.safeParse(p).success
);

const changedSchema = z
  .object({
    games: gameSessionsSchema,
    commandId: z.string(),
    reason: z.string(),
  })
  .strict();
export type GameSessionsChangedPayload = z.infer<typeof changedSchema>;
export const gameSessionEvtNs = createMessageNamespace('chess-custom-evt');
/** Payloads already found valid: an immutable event is checked once, not on every reading. */
const VALID_CHANGES = new WeakSet<object>();
export const GameSessionsChanged = gameSessionEvtNs(
  'changed',
  (p): p is GameSessionsChangedPayload => {
    if (typeof p === 'object' && p !== null && VALID_CHANGES.has(p))
      return true;
    const valid = changedSchema.safeParse(p).success;
    if (valid && typeof p === 'object' && p !== null) VALID_CHANGES.add(p);
    return valid;
  }
);
const moveSchema = z
  .object({ uci: z.string().min(1).max(256), san: z.string().min(1) })
  .strict();
const progressedSchema = z
  .object({
    /** The game as the change left it, its moves left out (`moves: []`). */
    game: gameSessionSchema,
    /** How many moves the game had before the change. */
    base: z.number().int().nonnegative(),
    /** The moves the change appended, in order; at least one. */
    moves: z.array(moveSchema).min(1),
    commandId: z.string(),
    reason: z.string(),
  })
  .strict();
export type GameSessionProgressedPayload = z.infer<typeof progressedSchema>;
const VALID_PROGRESS = new WeakSet<object>();
/**
 * A change that appended moves to the current game and left the rest of the
 * game sessions alone, recorded as just what it added: a long game's log then
 * grows by each move, not by the whole game again, and so does what a
 * returning device downloads. Every other change is `GameSessionsChanged`.
 */
export const GameSessionProgressed = gameSessionEvtNs(
  'progressed',
  (p): p is GameSessionProgressedPayload => {
    if (typeof p === 'object' && p !== null && VALID_PROGRESS.has(p))
      return true;
    const valid = progressedSchema.safeParse(p).success;
    if (valid && typeof p === 'object' && p !== null) VALID_PROGRESS.add(p);
    return valid;
  }
);

/** The command a change of the game sessions answers, and why, from either form of the change. */
export function gameSessionChangeAnswer(
  event: Message
): { readonly commandId: string; readonly reason: string } | null {
  if (GameSessionsChanged.is(event) || GameSessionProgressed.is(event))
    return { commandId: event.payload.commandId, reason: event.payload.reason };
  return null;
}

export const GameSessionAvailabilityChanged = gameSessionEvtNs(
  'availability-changed',
  (
    p
  ): p is {
    readonly available: boolean;
    readonly absence: z.infer<typeof gameSessionAbsenceSchema>;
  } =>
    z
      .object({ available: z.boolean(), absence: gameSessionAbsenceSchema })
      .strict()
      .safeParse(p).success
);

/**
 * Time away stopped or resumed counting because the space's host left or
 * came back: only the absence bookkeeping changes, never the room's own
 * availability.
 */
export const GameSessionAbsencePaused = gameSessionEvtNs(
  'absence-paused',
  (p): p is { readonly absence: z.infer<typeof gameSessionAbsenceSchema> } =>
    z.object({ absence: gameSessionAbsenceSchema }).strict().safeParse(p)
      .success
);
