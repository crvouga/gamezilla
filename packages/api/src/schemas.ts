import { z } from 'zod';

export const authClaimRequestSchema = z.object({
  googleIdToken: z.string(),
  principalId: z.string(),
});
