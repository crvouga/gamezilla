import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const authClaimRequestSchema = z.object({
  googleIdToken: z.string().min(1, 'googleIdToken must be non-empty').max(8192),
  deviceId: z.string().regex(UUID_REGEX, 'deviceId must be a valid UUID'),
});
