import { z } from 'zod';

export const syntheticPopulationConfigSchema = z.object({
  desired: z.number().int().min(0).max(10_000),
  capacityPerWorker: z.number().int().min(1).max(32),
  leaseMs: z.number().int().min(15_000).max(300_000),
  actionIntervalMs: z.number().int().min(500).max(60_000),
  sessionMs: z.number().int().min(60_000).max(86_400_000),
  preferredVersion: z.string().max(128),
  revision: z.number().int().min(0),
});
export type SyntheticPopulationConfig = z.infer<
  typeof syntheticPopulationConfigSchema
>;
export const DEFAULT_SYNTHETIC_POPULATION_CONFIG: SyntheticPopulationConfig = {
  desired: 0,
  capacityPerWorker: 1,
  leaseMs: 60_000,
  actionIntervalMs: 3_000,
  sessionMs: 30 * 60_000,
  preferredVersion: '',
  revision: 0,
};

export const syntheticPopulationCommandSchema = z.object({
  operationId: z.string().uuid(),
  command: z.enum(['pause', 'resume', 'restart', 'inspect']),
});
export type SyntheticPopulationCommand = z.infer<
  typeof syntheticPopulationCommandSchema
>;

export const activitySchema = z.enum([
  'offline',
  'authenticating',
  'browsing',
  'hosting',
  'joining',
  'matchmaking',
  'playing',
  'postGame',
  'recovering',
  'loggingOut',
]);
export type Activity = z.infer<typeof activitySchema>;

/** No live DOM, auth token or reactive state belongs in a durable checkpoint. */
export const checkpointSchema = z.object({
  schemaVersion: z.literal(1),
  activity: activitySchema,
  route: z.string().max(2048),
  spaceId: z.string().uuid().nullable(),
  matchId: z.string().max(128).nullable(),
  pendingOperationId: z.string().uuid().nullable(),
  policySeed: z.string().max(128),
  decisions: z.number().int().nonnegative(),
  startedAtMs: z.number().nonnegative(),
});
export type Checkpoint = z.infer<typeof checkpointSchema>;

const recoveryReferencesSchema = z.object({
  spaceId: z.string().uuid().nullable(),
  matchId: z.string().min(1).max(128).nullable(),
});

export function reconcileCheckpoint(
  value: unknown,
  nowMs: number,
  seed: string
): Checkpoint {
  let decoded = value;
  if (typeof value === 'string') {
    try {
      decoded = JSON.parse(value);
    } catch {
      decoded = null;
    }
  }
  const parsed = checkpointSchema.safeParse(decoded);
  if (parsed.success) {
    const ended =
      parsed.data.activity === 'offline' ||
      parsed.data.activity === 'loggingOut';
    return {
      ...parsed.data,
      activity: 'recovering',
      pendingOperationId: null,
      route: ended ? '/' : parsed.data.route,
      startedAtMs: ended ? nowMs : parsed.data.startedAtMs,
    };
  }
  const references = recoveryReferencesSchema.safeParse(decoded);
  const spaceId = references.success ? references.data.spaceId : null;
  const matchId = references.success ? references.data.matchId : null;
  return {
    schemaVersion: 1,
    activity: 'recovering',
    route: spaceId === null ? '/' : `/space/${spaceId}`,
    spaceId,
    matchId,
    pendingOperationId: null,
    policySeed: seed,
    decisions: 0,
    startedAtMs: nowMs,
  };
}
