import { FixedStepSimulation } from '@libs/game-session-shared-ts/simulation-engine';
import type {
  SimulationOptions,
  SimulationStep,
} from '@pkgs/turn-game-shared-ts/simulation';

/** Continuous movement of the existing framework example's racing token. */
export type RaceState = {
  readonly distance: number;
  readonly luck: number;
  readonly inputs: readonly string[];
};

export const simulationOptions: SimulationOptions = {
  tickRate: 60,
  maxCatchUpTicks: 120,
  maxQueuedInputs: 64,
  maxInputLeadTicks: 120,
  seed: 'counting-race',
};

export const raceStep: SimulationStep<RaceState, number> = (
  state,
  inputs,
  context
) => ({
  distance: state.distance + context.deltaMs,
  luck: state.luck + context.random(),
  inputs: [
    ...state.inputs,
    ...inputs.map(
      (input) =>
        `${context.tick}:${input.playerId}:${input.sequence}:${input.value}`
    ),
  ],
});

export function raceSimulation(options: Partial<SimulationOptions> = {}) {
  return new FixedStepSimulation(
    { distance: 0, luck: 0, inputs: [] } as RaceState,
    raceStep,
    { ...simulationOptions, ...options }
  );
}
