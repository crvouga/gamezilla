import { createMessageNamespace } from '@pkgs/message-shared/message';
import { z } from 'zod';
import type { CustomGameChoice } from './custom-game-choice';
import { customGameChoiceSchema } from './custom-game-choice';
import {
  customGameSideSchema,
  customGamesSchema,
} from './custom-game-state';

export const customGameCmdNs = createMessageNamespace('chess-custom-cmd');
export const ChangeCustomGame = customGameCmdNs(
  'change',
  (p): p is CustomGameChoice => customGameChoiceSchema.safeParse(p).success
);

const wakeSchema = z
  .object({
    gameId: z.string().min(1),
    ply: z.number().int().nonnegative(),
    side: customGameSideSchema,
  })
  .strict();
export type CustomGameWake = z.infer<typeof wakeSchema>;
export const PlayCustomGameBot = customGameCmdNs(
  'bot-turn',
  (p): p is CustomGameWake => wakeSchema.safeParse(p).success
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
