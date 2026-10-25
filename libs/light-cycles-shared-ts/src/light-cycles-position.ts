import type { SimulationCodec } from '@pkgs/turn-game-shared-ts/simulation';
import { lightCyclesCodec } from './light-cycles-codec';
import {
  LIGHT_CYCLES_SEATS,
  type LightCyclesRiderCount,
  lightCyclesConfig,
} from './light-cycles-config';
import {
  initialLightCyclesState,
  type LightCyclesState,
} from './light-cycles-state';

export const LIGHT_CYCLES_TARGETS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** The registered mode id of each rider count; one family owns all three. */
export const LIGHT_CYCLES_MODES = Object.freeze({
  2: 'light-cycles',
  3: 'light-cycles-3',
  4: 'light-cycles-4',
}) satisfies Readonly<Record<LightCyclesRiderCount, string>>;

const CODECS = new Map(
  LIGHT_CYCLES_TARGETS.map((targetScore) => [
    targetScore,
    lightCyclesCodec(lightCyclesConfig({ targetScore })),
  ])
);

/** The encoded target is the fourth field: `L1;width;height;target;…`. */
function codecFor(encoded: string): SimulationCodec<LightCyclesState> | null {
  const target = Number(encoded.split(';', 4)[3]);
  return CODECS.get(target as (typeof LIGHT_CYCLES_TARGETS)[number]) ?? null;
}

/** Mode-prefixed, strictly validated positions; a position names exactly one mode. */
export function lightCyclesPositionCodec(
  count: LightCyclesRiderCount
): SimulationCodec<LightCyclesState> {
  const prefix = `${LIGHT_CYCLES_MODES[count]}:`;
  return {
    encode: (state) => {
      const codec = CODECS.get(
        state.targetScore as (typeof LIGHT_CYCLES_TARGETS)[number]
      );
      if (codec === undefined || state.seats.length !== count)
        throw new Error('invalid Light Cycles state for this mode');
      return prefix + codec.encode(state);
    },
    decode: (position) => {
      if (!position.startsWith(prefix)) return null;
      const encoded = position.slice(prefix.length);
      const state = codecFor(encoded)?.decode(encoded) ?? null;
      return state !== null && state.seats.length === count ? state : null;
    },
  };
}

/** A fresh first round at `targetScore` round wins. */
export function lightCyclesStart(
  count: LightCyclesRiderCount,
  targetScore: number
): LightCyclesState {
  return initialLightCyclesState(
    lightCyclesConfig({ targetScore }),
    LIGHT_CYCLES_SEATS[count]
  );
}
