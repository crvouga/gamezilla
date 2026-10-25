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

/** A registered mode: its id, rider count, arena and round limit. */
export type LightCyclesMode = {
  readonly id: string;
  readonly count: LightCyclesRiderCount;
  readonly width: number;
  readonly height: number;
  readonly maxRounds: number;
};

/** The product mode of each rider count: the 40 x 28 arena and 15 rounds. */
export function lightCyclesMode(
  mode: LightCyclesRiderCount | LightCyclesMode
): LightCyclesMode {
  if (typeof mode !== 'number') return mode;
  const config = lightCyclesConfig();
  return {
    id: LIGHT_CYCLES_MODES[mode],
    count: mode,
    width: config.width,
    height: config.height,
    maxRounds: config.maxRounds,
  };
}

export function lightCyclesModeConfig(mode: LightCyclesMode, targetScore = 3) {
  return lightCyclesConfig({
    targetScore,
    width: mode.width,
    height: mode.height,
    maxRounds: mode.maxRounds,
  });
}

function codecs(mode: LightCyclesMode) {
  return new Map(
    LIGHT_CYCLES_TARGETS.map((targetScore) => [
      targetScore as number,
      lightCyclesCodec(lightCyclesModeConfig(mode, targetScore)),
    ])
  );
}

/** Mode-prefixed, strictly validated positions; a position names exactly one mode. */
export function lightCyclesPositionCodec(
  selected: LightCyclesRiderCount | LightCyclesMode
): SimulationCodec<LightCyclesState> {
  const mode = lightCyclesMode(selected);
  const byTarget = codecs(mode);
  const prefix = `${mode.id}:`;
  return {
    encode: (state) => {
      const codec = byTarget.get(state.targetScore);
      if (codec === undefined || state.seats.length !== mode.count)
        throw new Error('invalid Light Cycles state for this mode');
      return prefix + codec.encode(state);
    },
    decode: (position) => {
      if (!position.startsWith(prefix)) return null;
      const encoded = position.slice(prefix.length);
      // The encoded target is the fourth field: `L1;width;height;target;…`.
      const target = Number(encoded.split(';', 4)[3]);
      const state = byTarget.get(target)?.decode(encoded) ?? null;
      return state !== null && state.seats.length === mode.count ? state : null;
    },
  };
}

/** A fresh first round at `targetScore` round wins. */
export function lightCyclesStart(
  selected: LightCyclesRiderCount | LightCyclesMode,
  targetScore: number
): LightCyclesState {
  const mode = lightCyclesMode(selected);
  return initialLightCyclesState(
    lightCyclesModeConfig(mode, targetScore),
    LIGHT_CYCLES_SEATS[mode.count]
  );
}

/**
 * Any mode's position, for a board that renders every mode: the arena and
 * round limit come from the encoded header (`L1;width;height;target;rounds;…`)
 * and the strict codec still validates the whole state.
 */
export function decodeLightCyclesPosition(
  position: string
): LightCyclesState | null {
  const split = position.indexOf(':');
  if (split < 1) return null;
  const encoded = position.slice(split + 1);
  const [, width, height, target, rounds] = encoded.split(';', 5).map(Number);
  try {
    const config = lightCyclesConfig({
      width: width!,
      height: height!,
      targetScore: target!,
      maxRounds: rounds!,
    });
    return lightCyclesCodec(config).decode(encoded);
  } catch {
    return null;
  }
}
