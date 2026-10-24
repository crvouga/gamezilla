import { simulationExecutionSchema } from '@libs/game-matchmaking-shared-ts/simulation-execution';
import { createMessageNamespace } from '@pkgs/message-shared-ts/message';
import { z } from 'zod';

const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const SIMULATION_DISCONNECT_MS = 30_000;
export const SIMULATION_DISCONNECT_SCHEDULE = 'game-simulation:disconnect';

export const simulationSessionCmdNs = createMessageNamespace(
  'game-simulation-session'
);
const checkpointSchema = z
  .object({
    gameId: z.string().min(1),
    position: z.string().min(1).max(65_536),
    previousEpoch: z.string().nullable(),
    execution: simulationExecutionSchema,
  })
  .strict();
export type SimulationCheckpoint = z.infer<typeof checkpointSchema>;
export const CheckpointSimulation =
  simulationSessionCmdNs<SimulationCheckpoint>(
    'checkpoint',
    (value): value is SimulationCheckpoint =>
      checkpointSchema.safeParse(value).success
  );
const localCheckpointSchema = checkpointSchema.extend({ at: integer });
export type LocalSimulationCheckpoint = z.infer<typeof localCheckpointSchema>;
export const CheckpointLocalSimulation =
  simulationSessionCmdNs<LocalSimulationCheckpoint>(
    'local-checkpoint',
    (value): value is LocalSimulationCheckpoint =>
      localCheckpointSchema.safeParse(value).success
  );

const expirySchema = z
  .object({
    gameId: z.string().min(1),
    epoch: z.string().min(1),
    expiresAt: integer,
  })
  .strict();
export type SimulationExpiry = z.infer<typeof expirySchema>;
export const ExpireSimulation = simulationSessionCmdNs<SimulationExpiry>(
  'expire',
  (value): value is SimulationExpiry => expirySchema.safeParse(value).success
);
