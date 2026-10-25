/** Integer arena cells and fixed ticks, independent of viewport pixels and display frequency. */
export const LIGHT_CYCLES_CONFIG = Object.freeze({
  width: 40,
  height: 28,
  tickRate: 30,
  /** A rider enters one cell every this many ticks (10 cells per second). */
  movementTicks: 3,
  snapshotRate: 15,
  countdownTicks: 90,
  roundOverTicks: 60,
  targetScore: 3,
  maxRounds: 15,
  maxQueuedTurns: 2,
  maxCatchUpTicks: 6,
  maxQueuedInputs: 64,
  maxInputLeadTicks: 30,
});

export type LightCyclesConfig = {
  readonly [K in keyof typeof LIGHT_CYCLES_CONFIG]: number;
};

export type LightCyclesConfigOverrides = Partial<
  Pick<LightCyclesConfig, 'targetScore' | 'maxRounds' | 'width' | 'height'>
>;

export function lightCyclesConfig(
  overrides: LightCyclesConfigOverrides = {}
): LightCyclesConfig {
  const targetScore = overrides.targetScore ?? LIGHT_CYCLES_CONFIG.targetScore;
  const maxRounds = overrides.maxRounds ?? LIGHT_CYCLES_CONFIG.maxRounds;
  if (!Number.isSafeInteger(targetScore) || targetScore < 1 || targetScore > 9)
    throw new Error('Light Cycles score target must be an integer from 1 to 9');
  if (!Number.isSafeInteger(maxRounds) || maxRounds < 1 || maxRounds > 99)
    throw new Error('Light Cycles round limit must be an integer from 1 to 99');
  const width = overrides.width ?? LIGHT_CYCLES_CONFIG.width;
  const height = overrides.height ?? LIGHT_CYCLES_CONFIG.height;
  // Smaller arenas exist for bounded model checking; products use 40 x 28.
  for (const size of [width, height])
    if (!Number.isSafeInteger(size) || size < 3 || size > 64)
      throw new Error('Light Cycles arena sides must be integers from 3 to 64');
  return Object.freeze({
    ...LIGHT_CYCLES_CONFIG,
    targetScore,
    maxRounds,
    width,
    height,
  });
}

/** Seat tokens in canonical order; a trail cell stores its owner's index here. */
export const LIGHT_CYCLES_SEAT_ORDER = [
  'white',
  'black',
  'red',
  'blue',
] as const;
export type LightCyclesSeat = (typeof LIGHT_CYCLES_SEAT_ORDER)[number];
export type LightCyclesRiderCount = 2 | 3 | 4;

/** The only seat lists a game may use, by rider count. */
export const LIGHT_CYCLES_SEATS = Object.freeze({
  2: Object.freeze(['white', 'black'] as const),
  3: Object.freeze(['white', 'black', 'red'] as const),
  4: Object.freeze(['white', 'black', 'red', 'blue'] as const),
}) satisfies Readonly<
  Record<LightCyclesRiderCount, readonly LightCyclesSeat[]>
>;

export function isLightCyclesSeat(value: unknown): value is LightCyclesSeat {
  return (
    typeof value === 'string' &&
    (LIGHT_CYCLES_SEAT_ORDER as readonly string[]).includes(value)
  );
}

export function lightCyclesSeatIndex(seat: LightCyclesSeat): number {
  return LIGHT_CYCLES_SEAT_ORDER.indexOf(seat);
}

/** The seat list for one of the three layouts, or null for anything else. */
export function lightCyclesSeatLayout(
  seats: readonly string[]
): readonly LightCyclesSeat[] | null {
  if (seats.length !== 2 && seats.length !== 3 && seats.length !== 4)
    return null;
  const layout = LIGHT_CYCLES_SEATS[seats.length];
  return layout.every((seat, index) => seats[index] === seat) ? layout : null;
}

export type LightCyclesRiderIdentity = {
  readonly name: string;
  readonly mark: string;
};

/** Each rider is told apart by name and letter mark, never colour alone. */
export const LIGHT_CYCLES_RIDERS: Readonly<
  Record<LightCyclesSeat, LightCyclesRiderIdentity>
> = Object.freeze({
  white: Object.freeze({ name: 'Comet', mark: 'C' }),
  black: Object.freeze({ name: 'Ember', mark: 'E' }),
  red: Object.freeze({ name: 'Nova', mark: 'N' }),
  blue: Object.freeze({ name: 'Volt', mark: 'V' }),
});
