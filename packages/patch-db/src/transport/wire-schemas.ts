import { z } from 'zod';

/** Wire POST body for `/patches/read` (relative to patch-db base). */
export const patchDbReadBodySchema = z.object({
  queries: z.array(z.unknown()).min(1),
});

/** Wire POST body for `/patches/write`. */
export const patchDbWriteBodySchema = z.object({
  patches: z.array(z.unknown()).min(1),
});
