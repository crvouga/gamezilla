import { z } from 'zod';
import { LIGHT_CYCLES_HEADINGS } from './light-cycles-heading';

const inputSchema = z
  .object({
    round: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    heading: z.enum(LIGHT_CYCLES_HEADINGS),
  })
  .strict();

/** A direction command, fenced to the round it was issued in. */
export type LightCyclesInput = z.infer<typeof inputSchema>;

export function parseLightCyclesInput(value: unknown): LightCyclesInput | null {
  const parsed = inputSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
