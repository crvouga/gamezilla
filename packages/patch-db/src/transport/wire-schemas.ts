import { z } from 'zod';

const MAX_BATCH = 1_000;

/** Wire POST body for `/patches/read` (relative to patch-db base). */
export const patchDbReadBodySchema = z.object({
  queries: z.array(z.record(z.string(), z.unknown())).min(1).max(MAX_BATCH),
});

/** Wire POST body for `/patches/write`. */
export const patchDbWriteBodySchema = z.object({
  patches: z.array(z.record(z.string(), z.unknown())).min(1).max(MAX_BATCH),
});
