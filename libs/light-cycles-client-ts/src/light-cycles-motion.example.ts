import { lightCyclesBotInput } from '@libs/light-cycles-shared-ts/light-cycles-bot';
import {
  LIGHT_CYCLES_SEATS,
  lightCyclesConfig,
} from '@libs/light-cycles-shared-ts/light-cycles-config';
import { initialLightCyclesState } from '@libs/light-cycles-shared-ts/light-cycles-state';
import { createLightCyclesStep } from '@libs/light-cycles-shared-ts/light-cycles-step';
import { createSignal, onCleanup } from 'solid-js';

/** Precompute real states so render profiling does not also profile bot search. */
function motionTrace(count: 2 | 3 | 4) {
  const config = lightCyclesConfig();
  const step = createLightCyclesStep(config);
  const bot = lightCyclesBotInput(config);
  let state = initialLightCyclesState(config, LIGHT_CYCLES_SEATS[count]);
  const trace = [state];
  for (let tick = 1; tick <= 690; tick++) {
    const context = {
      tick,
      deltaMs: 1000 / config.tickRate,
      elapsedMs: (tick * 1000) / config.tickRate,
      random: () => 0,
    };
    const inputs = state.seats.map((seat) => ({
      playerId: seat,
      sequence: tick,
      tick,
      value: bot(state, seat, 'hard', context),
    }));
    state = step(state, inputs, context);
    trace.push(state);
  }
  return trace;
}

/** The existing Storybook virtual-time event replays each production state. */
export function lightCyclesMotion(count: 2 | 3 | 4, canvas: HTMLElement) {
  const trace = motionTrace(count);
  const initial = trace[450];
  if (!initial) throw new Error('Missing warm motion state');
  const [state, setState] = createSignal(initial);
  const tickRate = lightCyclesConfig().tickRate;
  let elapsed = 0;
  // Start with accumulated trails, not an empty field. The recorded trace
  // retains normal collisions, round transitions and countdowns.
  const advanceTime = (event: Event) => {
    const ms: unknown = (event as CustomEvent<unknown>).detail;
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return;
    elapsed += ms;
    const next =
      trace[Math.min(690, 450 + Math.floor((elapsed * tickRate) / 1000))];
    if (!next) throw new Error('Missing motion state');
    setState(next);
  };
  canvas.addEventListener('advance-story-time', advanceTime);
  onCleanup(() =>
    canvas.removeEventListener('advance-story-time', advanceTime)
  );
  return state;
}
