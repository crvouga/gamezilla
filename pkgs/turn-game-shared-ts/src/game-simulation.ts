import type { Random } from '@pkgs/uuid-shared-ts/create-id';
import { createSeededRng } from '@pkgs/uuid-shared-ts/seeded-rng';
import type { BotDifficulty, GameSide } from './game-rules';
import type {
  SimulationCodec,
  SimulationContext,
  SimulationInput,
  SimulationInterpolation,
  SimulationOptions,
  SimulationStep,
} from './simulation';
import { assertSimulationOptions } from './simulation';

export type SimulationTiming = Omit<SimulationOptions, 'seed'> & {
  readonly snapshotRate: number;
};
export type SimulationResult = {
  readonly winner: GameSide | 'draw';
  readonly reason: string;
};
export type SimulationMechanics<S, I> = {
  readonly initialize: (random: Random) => S;
  readonly step: SimulationStep<S, I>;
  readonly parseInput: (value: unknown) => I | null;
  readonly result: (state: S) => SimulationResult | null;
  readonly phase?: (state: S) => 'countdown' | 'running' | 'completed';
  /** Durable progress boundaries, such as a score change, rather than a tick journal. */
  readonly checkpointKey?: (state: S) => string;
  readonly resetInputs?: (state: S) => S;
};
export type SimulationBotInputs<S, I> = {
  readonly input: (
    state: S,
    player: GameSide,
    difficulty: BotDifficulty,
    context: SimulationContext
  ) => I;
};
/** A hybrid's command-owned fields, independent of its advancing simulation clock. */
export type SimulationCommands<S> = {
  /** Stable across simulation steps; distinguishes every accepted discrete position. */
  readonly key: (state: S) => string;
  /** Apply command-owned fields without replacing live motion or time. */
  readonly rebase: (current: S, changed: S) => S;
};
export type SimulationPresentation<S, I> = {
  readonly interpolate?: SimulationInterpolation<S>;
  readonly mergeLocal?: (presentation: S, predicted: S, player: GameSide) => S;
  /** Projects only the chosen player's responsive entities; never predicts the result. */
  readonly predict?: (
    state: S,
    player: GameSide,
    input: I,
    deltaMs: number
  ) => S;
  /** Chosen local entity's normalized distance [0, 1] at one tick; null if incomparable. */
  readonly predictionError?: (
    predicted: S,
    authoritative: S,
    player: GameSide
  ) => number | null;
};

/**
 * How people's controls reach the authority.
 *
 * - `held` (default): a continuously held control is coalesced on the device,
 *   refreshed periodically, and scheduled at a client-requested tick inside
 *   the lead window. Suits paddles and sticks.
 * - `commands`: each discrete command is sent once, in order. The authority
 *   ignores the client's tick as a schedule (it is only the latest
 *   authoritative tick the client saw) and assigns every accepted command to
 *   its next uncommitted tick, in arrival order. A command based on a tick
 *   older than `maxAgeTicks` is refused as late; at most
 *   `maxPendingPerPlayer` commands per player wait for application.
 */
export type SimulationInputPolicy =
  | { readonly mode: 'held' }
  | {
      readonly mode: 'commands';
      readonly maxPendingPerPlayer: number;
      readonly maxAgeTicks: number;
    };
/** A game-reported round identity; a command issued in another round is refused. */
export type SimulationRounds<S, I> = {
  readonly current: (state: S) => number;
  readonly ofInput: (input: I) => number;
};
/**
 * What an absent controller does to the running game.
 *
 * - `pause` (default): every absence pauses the whole simulation.
 * - `continue`: the simulation keeps running; the absent seat's pending
 *   inputs are fenced, and once it has been absent for `graceMs` the
 *   authority applies the game's pure `retire` before every step while the
 *   seat stays absent.
 */
export type SimulationDisconnection<S> =
  | { readonly policy: 'pause' }
  | {
      readonly policy: 'continue';
      readonly graceMs: number;
      readonly retire: (state: S, side: GameSide) => S;
    };

/** State stays typed inside the game; only this validated registration erases it for composition. */
export type RegisteredSimulation = {
  readonly timing: SimulationTiming;
  readonly initialize: (seed: string) => unknown;
  readonly step: SimulationStep<unknown, unknown>;
  readonly parseInput: (value: unknown) => unknown | null;
  readonly codec: SimulationCodec<unknown>;
  readonly result: (state: unknown) => SimulationResult | null;
  readonly phase?: (state: unknown) => 'countdown' | 'running' | 'completed';
  readonly checkpointKey?: (state: unknown) => string;
  readonly resetInputs?: (state: unknown) => unknown;
  readonly bots?: SimulationBotInputs<unknown, unknown>;
  readonly commands?: SimulationCommands<unknown>;
  readonly presentation?: SimulationPresentation<unknown, unknown>;
  readonly input?: SimulationInputPolicy;
  readonly rounds?: SimulationRounds<unknown, unknown>;
  readonly disconnection?: SimulationDisconnection<unknown>;
};

export const HELD_SIMULATION_INPUT: SimulationInputPolicy = { mode: 'held' };

/** The registered input policy, held unless the game declares commands. */
export function simulationInputPolicy(
  simulation: Pick<RegisteredSimulation, 'input'>
): SimulationInputPolicy {
  return simulation.input ?? HELD_SIMULATION_INPUT;
}

function assertExecutionFeatures(features: {
  readonly input?: SimulationInputPolicy;
  readonly disconnection?: {
    readonly policy: string;
    readonly graceMs?: number;
  };
}): void {
  const input = features.input;
  if (
    input?.mode === 'commands' &&
    !(
      Number.isSafeInteger(input.maxPendingPerPlayer) &&
      input.maxPendingPerPlayer >= 1 &&
      Number.isSafeInteger(input.maxAgeTicks) &&
      input.maxAgeTicks >= 1
    )
  )
    throw new Error('simulation commands need positive integer bounds');
  const disconnection = features.disconnection;
  if (
    disconnection?.policy === 'continue' &&
    !(
      disconnection.graceMs !== undefined &&
      Number.isFinite(disconnection.graceMs) &&
      disconnection.graceMs >= 0
    )
  )
    throw new Error('simulation disconnection grace must be finite');
}

/** Required execution parts, with independently optional bot and presentation capabilities. */
export function defineSimulation<S, I>(
  mechanics: SimulationMechanics<S, I>,
  codec: SimulationCodec<S>,
  timing: SimulationTiming,
  features: {
    readonly bots?: SimulationBotInputs<S, I>;
    readonly commands?: SimulationCommands<S>;
    readonly presentation?: SimulationPresentation<S, I>;
    readonly input?: SimulationInputPolicy;
    readonly rounds?: SimulationRounds<S, I>;
    readonly disconnection?: SimulationDisconnection<S>;
  } = {}
): RegisteredSimulation {
  assertSimulationOptions({ ...timing, seed: 'registration' });
  assertExecutionFeatures(features);
  if (!(timing.snapshotRate > 0 && timing.snapshotRate <= timing.tickRate))
    throw new Error('invalid simulation snapshot rate');
  const bots = features.bots;
  const presentation = features.presentation;
  return {
    timing: Object.freeze({ ...timing }),
    initialize: (seed) =>
      mechanics.initialize(createSeededRng(seed).fork('initial').random),
    // A state enters this boundary only from initialize, a successful step, or
    // codec.decode. Incoming controls always pass parseInput before execution.
    step: (state, inputs, context) =>
      mechanics.step(
        state as S,
        inputs as readonly SimulationInput<I>[],
        context
      ),
    parseInput: mechanics.parseInput,
    codec: {
      encode: (state) => codec.encode(state as S),
      decode: codec.decode,
    },
    result: (state) => mechanics.result(state as S),
    ...(mechanics.phase === undefined
      ? {}
      : { phase: (state: unknown) => mechanics.phase!(state as S) }),
    ...(mechanics.checkpointKey === undefined
      ? {}
      : {
          checkpointKey: (state: unknown) =>
            mechanics.checkpointKey!(state as S),
        }),
    ...(mechanics.resetInputs === undefined
      ? {}
      : {
          resetInputs: (state: unknown) => mechanics.resetInputs!(state as S),
        }),
    ...(bots === undefined
      ? {}
      : {
          bots: {
            input: (state, player, difficulty, context) =>
              bots.input(state as S, player, difficulty, context),
          } satisfies SimulationBotInputs<unknown, unknown>,
        }),
    ...erasedPresentation(presentation),
    ...erasedExecution(features),
    ...(features.commands === undefined
      ? {}
      : {
          commands: {
            key: (state: unknown) => features.commands!.key(state as S),
            rebase: (current: unknown, changed: unknown) =>
              features.commands!.rebase(current as S, changed as S),
          },
        }),
  };
}

function erasedPresentation<S, I>(
  presentation: SimulationPresentation<S, I> | undefined
): Pick<RegisteredSimulation, 'presentation'> {
  if (presentation === undefined) return {};
  return {
    presentation: {
      ...(presentation.mergeLocal === undefined
        ? {}
        : {
            mergeLocal: (
              state: unknown,
              predicted: unknown,
              player: GameSide
            ) => presentation.mergeLocal!(state as S, predicted as S, player),
          }),
      ...(presentation.interpolate === undefined
        ? {}
        : {
            interpolate: (a: unknown, b: unknown, fraction: number) =>
              presentation.interpolate!(a as S, b as S, fraction),
          }),
      ...(presentation.predict === undefined
        ? {}
        : {
            predict: (
              state: unknown,
              player: GameSide,
              input: unknown,
              deltaMs: number
            ) => presentation.predict!(state as S, player, input as I, deltaMs),
          }),
      ...(presentation.predictionError === undefined
        ? {}
        : {
            predictionError: (
              predicted: unknown,
              authoritative: unknown,
              player: GameSide
            ) =>
              presentation.predictionError!(
                predicted as S,
                authoritative as S,
                player
              ),
          }),
    },
  };
}

function erasedExecution<S, I>(features: {
  readonly input?: SimulationInputPolicy;
  readonly rounds?: SimulationRounds<S, I>;
  readonly disconnection?: SimulationDisconnection<S>;
}): Pick<RegisteredSimulation, 'input' | 'rounds' | 'disconnection'> {
  const { input, rounds, disconnection } = features;
  return {
    ...(input === undefined ? {} : { input: Object.freeze({ ...input }) }),
    ...(rounds === undefined
      ? {}
      : {
          rounds: {
            current: (state: unknown) => rounds.current(state as S),
            ofInput: (value: unknown) => rounds.ofInput(value as I),
          },
        }),
    ...(disconnection === undefined
      ? {}
      : {
          disconnection:
            disconnection.policy === 'pause'
              ? { policy: 'pause' as const }
              : {
                  policy: 'continue' as const,
                  graceMs: disconnection.graceMs,
                  retire: (state: unknown, side: GameSide) =>
                    disconnection.retire(state as S, side),
                },
        }),
  };
}
