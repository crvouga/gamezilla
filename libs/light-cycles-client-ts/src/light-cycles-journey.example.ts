import {
  LIGHT_CYCLES_SEATS,
  lightCyclesConfig,
} from '@libs/light-cycles-shared-ts/light-cycles-config';
import { parseLightCyclesInput } from '@libs/light-cycles-shared-ts/light-cycles-input';
import { initialLightCyclesState } from '@libs/light-cycles-shared-ts/light-cycles-state';
import { createLightCyclesStep } from '@libs/light-cycles-shared-ts/light-cycles-step';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { createSignal } from 'solid-js';

/** Virtual simulation time; the production step owns every transition. */
export function createLightCyclesJourney(
  count: 2 | 3 | 4,
  initially: {
    readonly stale: boolean;
    readonly singleTickInputs?: boolean;
  } = { stale: false }
) {
  const config = lightCyclesConfig();
  const step = createLightCyclesStep(config);
  // The simulation itself is plain data, stepped as it is asked to; the
  // signal only shows where it stands, so it can be stepped while a story
  // is being built as well as from an input.
  let current = initialLightCyclesState(config, LIGHT_CYCLES_SEATS[count]);
  let tick = 0;
  function stepBy(ticks: number, playerId?: GameSide, value?: unknown): void {
    const input = parseLightCyclesInput(value);
    for (let frame = 0; frame < ticks; frame++) {
      tick++;
      current = step(
        current,
        frame === 0 && playerId && input
          ? [{ playerId, value: input, sequence: tick, tick }]
          : [],
        {
          tick,
          deltaMs: 1000 / config.tickRate,
          elapsedMs: (tick * 1000) / config.tickRate,
          random: () => 0,
        }
      );
    }
  }
  stepBy(120);
  const [state, setState] = createSignal(current);
  const [stale, setStale] = createSignal(initially.stale);
  function advance(ticks: number, playerId?: GameSide, value?: unknown): void {
    stepBy(ticks, playerId, value);
    setState(() => current);
  }
  return {
    state,
    stale,
    setStale,
    advance,
    onInput: (side: GameSide, value: unknown) =>
      advance(
        initially.singleTickInputs ? 1 : config.movementTicks,
        side,
        value
      ),
  };
}
export type LightCyclesJourney = ReturnType<typeof createLightCyclesJourney>;
