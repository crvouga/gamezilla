import { lightCyclesBotInput } from '@libs/light-cycles-shared-ts/light-cycles-bot';
import {
  LIGHT_CYCLES_SEATS,
  lightCyclesConfig,
} from '@libs/light-cycles-shared-ts/light-cycles-config';
import { initialLightCyclesState } from '@libs/light-cycles-shared-ts/light-cycles-state';
import { createLightCyclesStep } from '@libs/light-cycles-shared-ts/light-cycles-step';
import { createSignal, onCleanup } from 'solid-js';

/** Production simulation and hard bots; the existing Storybook virtual-time event drives every tick. */
export function lightCyclesMotion(count: 2 | 3 | 4, canvas: HTMLElement) {
  const config = lightCyclesConfig();
  const step = createLightCyclesStep(config);
  const bot = lightCyclesBotInput(config);
  const [state, setState] = createSignal(
    initialLightCyclesState(config, LIGHT_CYCLES_SEATS[count])
  );
  let tick = 0;
  let elapsed = 0;
  const advance = (ticks: number) => {
    for (let index = 0; index < ticks; index++) {
      tick++;
      const context = {
        tick,
        deltaMs: 1000 / config.tickRate,
        elapsedMs: (tick * 1000) / config.tickRate,
        random: () => 0,
      };
      const current = state();
      const inputs = current.seats.map((seat) => ({
        playerId: seat,
        sequence: tick,
        tick,
        value: bot(current, seat, 'hard', context),
      }));
      setState(step(current, inputs, context));
    }
  };
  // Start with accumulated trails, not an empty field. The recorded trace
  // retains normal collisions, round transitions and countdowns.
  advance(450);
  const advanceTime = (event: Event) => {
    const ms: unknown = (event as CustomEvent<unknown>).detail;
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return;
    const previous = Math.floor((elapsed * config.tickRate) / 1000);
    elapsed += ms;
    advance(Math.floor((elapsed * config.tickRate) / 1000) - previous);
  };
  canvas.addEventListener('advance-story-time', advanceTime);
  onCleanup(() =>
    canvas.removeEventListener('advance-story-time', advanceTime)
  );
  return state;
}
