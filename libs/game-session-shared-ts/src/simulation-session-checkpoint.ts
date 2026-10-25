import type { SimulationExecution } from '@pkgs/turn-game-shared-ts/simulation-execution';
import type { SimulationCheckpoint } from './simulation-session-state';

/** An already queued authority checkpoint may trail a newer presence change. */
export function staleSimulationCheckpoint(
  before: SimulationExecution | undefined,
  checkpoint: SimulationCheckpoint
): boolean {
  const after = checkpoint.execution;
  return (
    before !== undefined &&
    before.epoch === after.epoch &&
    (after.tick < before.tick ||
      after.inputGeneration < before.inputGeneration ||
      Object.entries(before.acknowledged).some(
        ([player, sequence]) => (after.acknowledged[player] ?? 0) < sequence
      ))
  );
}

export function validSimulationCheckpoint(
  before: SimulationExecution | undefined,
  checkpoint: SimulationCheckpoint
): boolean {
  const after = checkpoint.execution;
  const newEpoch = checkpoint.previousEpoch !== after.epoch;
  if (newEpoch)
    return (
      checkpoint.previousEpoch === (before?.epoch ?? null) &&
      after.generation === (before?.generation ?? 0) + 1 &&
      after.tick === (before?.tick ?? 0)
    );
  if (
    before === undefined ||
    before.epoch !== after.epoch ||
    after.tick < before.tick ||
    after.inputGeneration < before.inputGeneration
  )
    return false;
  return Object.entries(before.acknowledged).every(
    ([player, sequence]) => (after.acknowledged[player] ?? 0) >= sequence
  );
}
