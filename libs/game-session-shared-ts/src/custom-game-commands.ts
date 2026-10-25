import {
  createMessageNamespace,
  type Message,
} from '@pkgs/message-shared-ts/message';
import { z } from 'zod';
import { customGameAbsenceSchema } from './custom-game-absence';
import type { CustomGameChoice } from './custom-game-choice';
import { customGameChoiceSchema } from './custom-game-choice';
import {
  customGameSchema,
  customGameSideSchema,
  customGamesSchema,
} from './custom-game-state';

export const customGameCmdNs = createMessageNamespace('chess-custom-cmd');
export const ChangeCustomGame = customGameCmdNs(
  'change',
  (p): p is CustomGameChoice => customGameChoiceSchema.safeParse(p).success
);

const localChangeSchema = z
  .object({
    choice: customGameChoiceSchema,
    at: z.number().int().nonnegative(),
    /**
     * The draws a solo game with dealt hands deals from, drawn once on the
     * creator's device, so every copy deals the same hands.
     */
    draws: z.array(z.number().min(0).lt(1)).max(64).optional(),
  })
  .strict();
export type ChangeLocalCustomGamePayload = z.infer<typeof localChangeSchema>;
export const ChangeLocalCustomGame = customGameCmdNs(
  'local-change',
  (p): p is ChangeLocalCustomGamePayload =>
    localChangeSchema.safeParse(p).success
);

const wakeSchema = z
  .object({
    gameId: z.string().min(1),
    ply: z.number().int().nonnegative(),
    side: customGameSideSchema,
  })
  .strict();
export type CustomGameWake = z.infer<typeof wakeSchema>;
const localWakeSchema = wakeSchema.extend({
  at: z.number().int().nonnegative(),
});
const botMoveSchema = localWakeSchema.extend({
  move: z.string().min(1).max(256),
});
export type CustomGameBotWake = CustomGameWake | z.infer<typeof botMoveSchema>;
export const PlayCustomGameBot = customGameCmdNs(
  'bot-turn',
  (p): p is CustomGameBotWake =>
    z.union([wakeSchema, botMoveSchema]).safeParse(p).success
);
export const EndLocalCustomGameOnTime = customGameCmdNs(
  'local-time-up',
  (p): p is z.infer<typeof localWakeSchema> =>
    localWakeSchema.safeParse(p).success
);
/** The room's wake once an away participant's grace period may have passed. */
export const StandInCustomGame = customGameCmdNs(
  'stand-in',
  (p): p is { readonly gameId: string } =>
    z.object({ gameId: z.string().min(1) }).strict().safeParse(p).success
);
export const EndCustomGameOnTime = customGameCmdNs(
  'time-up',
  (p): p is CustomGameWake => wakeSchema.safeParse(p).success
);

const changedSchema = z
  .object({
    games: customGamesSchema,
    commandId: z.string(),
    reason: z.string(),
  })
  .strict();
export type CustomGamesChangedPayload = z.infer<typeof changedSchema>;
export const customGameEvtNs = createMessageNamespace('chess-custom-evt');
/** Payloads already found valid: an immutable event is checked once, not on every reading. */
const VALID_CHANGES = new WeakSet<object>();
export const CustomGamesChanged = customGameEvtNs(
  'changed',
  (p): p is CustomGamesChangedPayload => {
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
    game: customGameSchema,
    /** How many moves the game had before the change. */
    base: z.number().int().nonnegative(),
    /** The moves the change appended, in order; at least one. */
    moves: z.array(moveSchema).min(1),
    commandId: z.string(),
    reason: z.string(),
  })
  .strict();
export type CustomGameProgressedPayload = z.infer<typeof progressedSchema>;
const VALID_PROGRESS = new WeakSet<object>();
/**
 * A change that appended moves to the current game and left the rest of the
 * custom games alone, recorded as just what it added: a long game's log then
 * grows by each move, not by the whole game again, and so does what a
 * returning device downloads. Every other change is `CustomGamesChanged`.
 */
export const CustomGameProgressed = customGameEvtNs(
  'progressed',
  (p): p is CustomGameProgressedPayload => {
    if (typeof p === 'object' && p !== null && VALID_PROGRESS.has(p))
      return true;
    const valid = progressedSchema.safeParse(p).success;
    if (valid && typeof p === 'object' && p !== null) VALID_PROGRESS.add(p);
    return valid;
  }
);

/** The command a change of the custom games answers, and why, from either form of the change. */
export function customGameChangeAnswer(
  event: Message
): { readonly commandId: string; readonly reason: string } | null {
  if (CustomGamesChanged.is(event) || CustomGameProgressed.is(event))
    return { commandId: event.payload.commandId, reason: event.payload.reason };
  return null;
}

export const CustomGameAvailabilityChanged = customGameEvtNs(
  'availability-changed',
  (
    p
  ): p is {
    readonly available: boolean;
    readonly absence: z.infer<typeof customGameAbsenceSchema>;
  } =>
    z
      .object({ available: z.boolean(), absence: customGameAbsenceSchema })
      .strict()
      .safeParse(p).success
);
