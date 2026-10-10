import { z } from 'zod';

export const personalitySchema = z.object({
  hostingWeight: z.number().min(0).max(1),
  skill: z.literal('beginner'),
});
export type Personality = z.infer<typeof personalitySchema>;

/** Existing recorded identities and overlapping protocol versions use the established policy. */
export function readPersonality(value: unknown): Personality {
  const parsed = personalitySchema.safeParse(value);
  return parsed.success
    ? parsed.data
    : { hostingWeight: 0.3, skill: 'beginner' };
}

export function provisionPersonality(identity: string): Personality {
  const draw =
    Number.parseInt(identity.replaceAll('-', '').slice(0, 2), 16) / 255;
  return { hostingWeight: 0.15 + draw * 0.35, skill: 'beginner' };
}
