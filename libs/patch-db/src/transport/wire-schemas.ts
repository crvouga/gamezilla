import { z } from 'zod';

/**
 * Maximum number of patches the wire `/patches/write` endpoint accepts in
 * a single request. Tiger-style contract: clients MUST chunk pushes to fit
 * this bound. Asserted on both ends — the client crashes before sending an
 * over-sized batch (programmer error), and the server validates as a
 * defense-in-depth guard against untrusted inputs.
 */
export const MAX_PATCHES_PER_REQUEST = 1_000;

/** Maximum number of queries the wire `/patches/read` endpoint accepts. */
export const MAX_QUERIES_PER_REQUEST = 1_000;

/** Wire POST body for `/patches/read` (relative to patch-db base). */
export const patchDbReadBodySchema = z.object({
  queries: z
    .array(z.record(z.string(), z.unknown()))
    .min(1)
    .max(MAX_QUERIES_PER_REQUEST),
});

/** Wire POST body for `/patches/write`. */
export const patchDbWriteBodySchema = z.object({
  patches: z
    .array(z.record(z.string(), z.unknown()))
    .min(1)
    .max(MAX_PATCHES_PER_REQUEST),
});

const patchRejectionReasonSchema = z.object({
  patchId: z.string(),
  code: z.string(),
  reason: z.string(),
});

/** Wire JSON body for successful `/patches/write` responses. */
export const patchDbWriteResponseSchema = z.object({
  accepted: z.array(z.record(z.string(), z.unknown())),
  rejected: z.array(patchRejectionReasonSchema),
});
