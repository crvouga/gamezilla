import { ReproducibleError } from '@pkgs/observability-root-shared-ts/reproducible-error';
import type {
  BotDifficulty,
  GameSide,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type {
  SimulationInput,
  SimulationOptions,
  SimulationSnapshot,
} from '@pkgs/turn-game-shared-ts/simulation';

export type SimulationReproduction<S, I> = {
  readonly options: SimulationOptions;
  readonly before: SimulationSnapshot<S>;
  readonly inputs: readonly SimulationInput<I>[];
  readonly session?: SimulationReproductionSession;
};

export type SimulationReproductionSession = {
  /** Identifies registered mechanics; replay starts from before.state, not this position. */
  readonly position: string;
  readonly bots: readonly {
    readonly side: GameSide;
    readonly difficulty: BotDifficulty;
  }[];
};

/** A failing step can be replayed from its checkpoint with the same tick-local RNG. */
export class SimulationFailure<S, I> extends ReproducibleError {
  readonly reproduction: SimulationReproduction<S, I>;

  constructor(reproduction: SimulationReproduction<S, I>, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(
      `simulation step ${reproduction.before.tick + 1} failed: ${reason}`,
      { cause },
      {
        format: 'simulation-step.v1',
        value: reproduction,
      }
    );
    this.name = 'SimulationFailure';
    this.reproduction = structuredClone(reproduction);
    Object.defineProperty(this, 'reproduction', {
      enumerable: false,
      writable: false,
    });
  }

  withSession(session: SimulationReproductionSession): SimulationFailure<S, I> {
    return new SimulationFailure({ ...this.reproduction, session }, this.cause);
  }
}
