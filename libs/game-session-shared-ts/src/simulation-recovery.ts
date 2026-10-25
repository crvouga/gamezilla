import type { Message } from '@pkgs/message-shared-ts/message';
import { createMessageNamespace } from '@pkgs/message-shared-ts/message';
import { z } from 'zod';
import type { SimulationSessionView } from './simulation-session-runtime';
import { simulationCheckpointSchema } from './simulation-session-state';

const schema = z
  .object({
    source: z.string().min(1).max(131_072),
    checkpoint: simulationCheckpointSchema,
  })
  .strict();
export type SimulationRecovery = z.infer<typeof schema>;
export const RecoverSimulation = createMessageNamespace(
  'game-simulation-recovery'
)<z.infer<typeof schema>>(
  'checkpoint',
  (value): value is z.infer<typeof schema> => schema.safeParse(value).success
);

/** Exact durable anchor: an intervening choice, seat change or round supersedes this frame. */
export function simulationRecoverySource(view: SimulationSessionView): string {
  return JSON.stringify({
    id: view.id,
    position: view.position,
    execution: view.execution,
    controllers: [...view.controllers].sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0
    ),
  });
}

export function recoverSimulation(
  view: SimulationSessionView | null,
  payload: Message
) {
  if (view === null || !view.active || !RecoverSimulation.is(payload))
    return null;
  const saved = payload.payload;
  const execution = view.execution;
  if (
    execution === undefined ||
    saved.source !== simulationRecoverySource(view) ||
    saved.checkpoint.gameId !== view.id ||
    saved.checkpoint.previousEpoch !== execution.epoch ||
    saved.checkpoint.execution.epoch !== execution.epoch ||
    saved.checkpoint.execution.generation !== execution.generation ||
    saved.checkpoint.execution.inputGeneration !== execution.inputGeneration ||
    saved.checkpoint.execution.tick < execution.tick ||
    view.simulation.codec.decode(saved.checkpoint.position) === null
  )
    return null;
  return saved.checkpoint;
}
