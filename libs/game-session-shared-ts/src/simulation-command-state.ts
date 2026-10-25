import type { RegisteredSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';
import type { FixedStepSimulation } from './simulation-engine';
import type { SimulationSessionView } from './simulation-session-runtime';

export function simulationCommandKey(
  simulation: RegisteredSimulation,
  position: string
): string | null {
  if (simulation.commands === undefined) return null;
  const decoded = simulation.codec.decode(position);
  if (decoded === null) throw new Error('invalid simulation command position');
  return simulation.commands.key(decoded);
}

export function rebaseSimulationCommand(
  engine: FixedStepSimulation<unknown, unknown>,
  before: SimulationSessionView,
  after: SimulationSessionView
): boolean {
  const simulation = after.simulation;
  if (simulation.commands === undefined) return false;
  if (
    simulationCommandKey(simulation, before.position) ===
    simulationCommandKey(simulation, after.position)
  )
    return false;
  const changed = simulation.codec.decode(after.position);
  if (changed === null) throw new Error('invalid simulation command position');
  engine.rebase(simulation.commands.rebase(engine.snapshot().state, changed));
  return true;
}
