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
export function createLightCyclesJourney(count: 2 | 3 | 4) {
  const config = lightCyclesConfig();
  const step = createLightCyclesStep(config);
  const [state, setState] = createSignal(
    initialLightCyclesState(config, LIGHT_CYCLES_SEATS[count])
  );
  const [stale, setStale] = createSignal(false);
  let tick = 0;
  function advance(ticks: number, playerId?: GameSide, value?: unknown) {
    const input = parseLightCyclesInput(value);
    for (let frame = 0; frame < ticks; frame++) {
      tick++;
      setState((current) =>
        step(
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
        )
      );
    }
  }
  advance(120);
  return {
    state,
    stale,
    setStale,
    advance,
    onInput: (side: GameSide, value: unknown) =>
      advance(config.movementTicks, side, value),
  };
}
export type LightCyclesJourney = ReturnType<typeof createLightCyclesJourney>;
