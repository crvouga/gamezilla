import type { Random } from '@pkgs/uuid-shared-ts/create-id';

/** The tick being committed, starting at one; duration is always 1000 / tickRate. */
export type SimulationContext = {
  readonly tick: number;
  readonly deltaMs: number;
  readonly elapsedMs: number;
  /** A tick-local stream from the repository's seeded RNG, independent of delivery order. */
  readonly random: Random;
};

/** A player's intent, never an authoritative state supplied by that player. */
export type SimulationInput<I> = {
  readonly playerId: string;
  readonly sequence: number;
  readonly tick: number;
  readonly value: I;
};

/** Pure mechanics. Initialization, codecs, bots and presentation are independent contracts. */
export type SimulationStep<S, I> = (
  state: S,
  inputs: readonly SimulationInput<I>[],
  context: SimulationContext
) => S;

export type SimulationCodec<S> = {
  readonly encode: (state: S) => string;
  /** Refuses unrecognized, malformed and out-of-bounds states. */
  readonly decode: (encoded: string) => S | null;
};

export type SimulationBots<S, I> = {
  /** Bots produce exactly the same validated input values as people. */
  readonly input: (state: S, playerId: string, context: SimulationContext) => I;
};

export type SimulationInterpolation<S> = (
  previous: S,
  current: S,
  fraction: number
) => S;

export type SimulationOptions = {
  readonly tickRate: number;
  readonly maxCatchUpTicks: number;
  readonly maxQueuedInputs: number;
  readonly maxInputLeadTicks: number;
  readonly seed: string;
};

export type SimulationSnapshot<S> = {
  readonly tick: number;
  readonly state: S;
  /** Highest applied sequence per player, carried with the state it acknowledges. */
  readonly acknowledged: Readonly<Record<string, number>>;
};

export type SimulationInputResult =
  | { readonly accepted: true }
  | {
      readonly accepted: false;
      readonly reason: 'invalid' | 'late' | 'future' | 'duplicate' | 'full';
    };

export function simulationInteger(value: number, minimum: number): boolean {
  return Number.isSafeInteger(value) && value >= minimum;
}

export function assertSimulationOptions(options: SimulationOptions): void {
  for (const key of [
    'tickRate',
    'maxCatchUpTicks',
    'maxQueuedInputs',
    'maxInputLeadTicks',
  ] as const)
    if (!simulationInteger(options[key], 1))
      throw new Error(`simulation ${key} must be a positive safe integer`);
  if (options.tickRate > 1000)
    throw new Error('simulation tickRate must not exceed 1000');
}
