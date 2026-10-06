import { z } from 'zod';
import { customGameSideSchema } from './custom-game-state';

const reference = {
  gameId: z.string().min(1).nullable(),
  revision: z.number().int().nonnegative(),
};
export const customGameChoiceSchema = z.discriminatedUnion('operation', [
  z
    .object({
      ...reference,
      operation: z.enum([
        'create',
        'rematch',
        'ready',
        'unready',
        'swap',
        'start',
        'cancel',
        'resign',
        'offer',
        'agree',
        'reject',
        'untimed',
        'claimWin',
      ]),
    })
    .strict(),
  z
    .object({
      ...reference,
      operation: z.enum([
        'take',
        'bot',
        'open',
        'close',
        'accept',
        'decline',
        'revoke',
        'claim',
        'release',
      ]),
      side: customGameSideSchema,
    })
    .strict(),
  z
    .object({
      ...reference,
      operation: z.literal('invite'),
      side: customGameSideSchema,
      person: z.string().min(1),
    })
    .strict(),
  z
    .object({
      ...reference,
      operation: z.literal('clock'),
      minutes: z.number(),
      increment: z.number(),
    })
    .strict(),
  z
    .object({
      ...reference,
      operation: z.literal('move'),
      uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
      ply: z.number().int().nonnegative(),
    })
    .strict(),
]);
export type CustomGameChoice = z.infer<typeof customGameChoiceSchema>;
export type CustomGameOperation = CustomGameChoice['operation'];
type InputOf<C> = C extends CustomGameChoice
  ? Omit<C, 'gameId' | 'revision'>
  : never;
export type CustomGameInput = InputOf<CustomGameChoice>;
