import { z } from 'zod';

export const inspectionSchema = z.object({
  capturedAtMs: z.number().nonnegative(),
  generation: z.number().int().positive(),
  route: z.string().max(2048),
  html: z.string().max(200_000),
  state: z.string().max(128),
  transitions: z.array(z.string().max(128)).max(32),
  controls: z
    .array(
      z.object({
        testId: z.string().max(128),
        role: z.string().max(64),
        name: z.string().max(256),
      })
    )
    .max(200),
  actions: z
    .array(
      z.object({
        atMs: z.number(),
        action: z.string().max(256),
        outcome: z.enum(['started', 'completed', 'failed']),
      })
    )
    .max(50),
});
export type Inspection = z.infer<typeof inspectionSchema>;
