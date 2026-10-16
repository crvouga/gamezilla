import { createMessageNamespace } from '@pkgs/message-shared/message';
import { z } from 'zod';
import { customGameAbsenceSchema } from './custom-game-absence';
import type { CustomGameChoice } from './custom-game-choice';
import { customGameChoiceSchema } from './custom-game-choice';
import { customGameSideSchema, customGamesSchema } from './custom-game-state';

export const customGameCmdNs = createMessageNamespace('chess-custom-cmd');
export const ChangeCustomGame = customGameCmdNs(
  'change',
  (p): p is CustomGameChoice => customGameChoiceSchema.safeParse(p).success
);

export const ChangeLocalCustomGame = customGameCmdNs(
  'local-change',
  (p): p is { choice: CustomGameChoice; at: number } =>
    z
      .object({
        choice: customGameChoiceSchema,
        at: z.number().int().nonnegative(),
      })
      .strict()
      .safeParse(p).success
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
export const CustomGamesChanged = customGameEvtNs(
  'changed',
  (p): p is CustomGamesChangedPayload => changedSchema.safeParse(p).success
);
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
