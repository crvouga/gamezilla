import type { SimulationExecution } from '@pkgs/turn-game-shared-ts/simulation-execution';
import { z } from 'zod';

const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const simulationExecutionSchema: z.ZodType<SimulationExecution> = z
  .object({
    epoch: z.string().min(1).max(256),
    generation: integer.min(1),
    inputGeneration: integer,
    tick: integer,
    acknowledged: z.record(z.string().min(1).max(256), integer),
    phase: z.enum(['countdown', 'running', 'paused', 'completed', 'abandoned']),
    started: z.boolean(),
    missing: z.array(z.enum(['white', 'black'])).max(2),
    expiresAt: integer.nullable(),
  })
  .strict();
