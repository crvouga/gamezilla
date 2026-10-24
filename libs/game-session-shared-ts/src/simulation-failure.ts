import type {
  SimulationInput,
  SimulationOptions,
  SimulationSnapshot,
} from '@pkgs/turn-game-shared-ts/simulation';

export type SimulationReproduction<S, I> = {
  readonly options: SimulationOptions;
  readonly before: SimulationSnapshot<S>;
  readonly inputs: readonly SimulationInput<I>[];
};

/** A failing step can be replayed from its checkpoint with the same tick-local RNG. */
export class SimulationFailure<S, I> extends Error {
  readonly reproduction: SimulationReproduction<S, I>;

  constructor(reproduction: SimulationReproduction<S, I>, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`simulation step ${reproduction.before.tick + 1} failed: ${reason}`, {
      cause,
    });
    this.name = 'SimulationFailure';
    this.reproduction = structuredClone(reproduction);
  }
}
