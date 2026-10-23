import { z } from 'zod';
import { chooseActivity } from './decision-policy';

export const decisionReplaySchema = z.object({
  hasActiveMatch: z.boolean(),
  hasQueueEntry: z.boolean(),
  availableSpaces: z.array(z.string().max(128)).max(32),
  paused: z.boolean(),
  draining: z.boolean(),
  sessionElapsedMs: z.number().nonnegative(),
  sessionLimitMs: z.number().nonnegative(),
  hostingWeight: z.number(),
  draws: z.array(z.number().min(0).lt(1)).max(2),
  selected: z.object({
    activity: z.string(),
    targetControlId: z.string().nullable(),
  }),
});

/** Only the recorded Decision Policy is replayed; services and UI timing remain external. */
export function replayDecision(value: unknown) {
  const input = decisionReplaySchema.safeParse(value);
  if (!input.success) return null;
  let index = 0;
  const selected = chooseActivity(input.data, () => {
    const draw = input.data.draws[index++];
    if (draw === undefined) throw new Error('Replay is missing a random input');
    return draw;
  });
  return {
    selected,
    matches:
      selected.activity === input.data.selected.activity &&
      selected.targetControlId === input.data.selected.targetControlId &&
      index === input.data.draws.length,
  };
}
