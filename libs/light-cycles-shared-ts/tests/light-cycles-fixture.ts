import { lightCyclesBotInput } from '@libs/light-cycles-shared-ts/light-cycles-bot';
import {
  LIGHT_CYCLES_SEATS,
  type LightCyclesConfig,
  type LightCyclesRiderCount,
  type LightCyclesSeat,
} from '@libs/light-cycles-shared-ts/light-cycles-config';
import {
  LIGHT_CYCLES_HEADINGS,
  type LightCyclesHeading,
} from '@libs/light-cycles-shared-ts/light-cycles-heading';
import type { LightCyclesInput } from '@libs/light-cycles-shared-ts/light-cycles-input';
import {
  initialLightCyclesState,
  type LightCyclesState,
} from '@libs/light-cycles-shared-ts/light-cycles-state';
import { createLightCyclesStep } from '@libs/light-cycles-shared-ts/light-cycles-step';
import type {
  SimulationContext,
  SimulationInput,
} from '@pkgs/turn-game-shared-ts/simulation';
import { createSeededRng } from '@pkgs/uuid-shared-ts/seeded-rng';

/** One command a seat sends at a tick; the round defaults to the current one. */
export type ScheduledTurn = {
  readonly seat: string;
  readonly heading: LightCyclesHeading;
  readonly round?: number;
};
/** Index t holds the commands applied at tick t + 1. */
export type LightCyclesSchedule = readonly (readonly ScheduledTurn[])[];

export function stepContext(
  config: LightCyclesConfig,
  seed: string,
  tick: number
): SimulationContext {
  const deltaMs = 1000 / config.tickRate;
  return {
    tick,
    deltaMs,
    elapsedMs: tick * deltaMs,
    random: createSeededRng(seed).fork(String(tick)).random,
  };
}

/** Engine order: by player, then by sequence within a player. */
export function scheduledInputs(
  state: LightCyclesState,
  turns: readonly ScheduledTurn[],
  tick: number
): SimulationInput<LightCyclesInput>[] {
  return turns
    .map((turn, sequence) => ({
      playerId: turn.seat,
      sequence: tick * 1024 + sequence,
      tick,
      value: { round: turn.round ?? state.round, heading: turn.heading },
    }))
    .sort((a, b) =>
      a.playerId < b.playerId
        ? -1
        : a.playerId > b.playerId
          ? 1
          : a.sequence - b.sequence
    );
}

/** Every state from the initial one through the schedule's last tick. */
export function playLightCycles(
  config: LightCyclesConfig,
  seats: readonly LightCyclesSeat[],
  schedule: LightCyclesSchedule,
  seed = 'light-cycles'
): LightCyclesState[] {
  return playFrom(
    config,
    initialLightCyclesState(config, seats),
    schedule,
    seed
  );
}

export function playFrom(
  config: LightCyclesConfig,
  initial: LightCyclesState,
  schedule: LightCyclesSchedule,
  seed = 'light-cycles'
): LightCyclesState[] {
  const step = createLightCyclesStep(config);
  const states = [initial];
  for (const [index, turns] of schedule.entries()) {
    const tick = index + 1;
    const state = states.at(-1)!;
    states.push(
      step(
        state,
        scheduledInputs(state, turns, tick),
        stepContext(config, seed, tick)
      )
    );
  }
  return states;
}

/** A seeded schedule of random commands, `density` of them per tick on average. */
export function randomSchedule(
  seed: number,
  ticks: number,
  count: LightCyclesRiderCount,
  density: number
): LightCyclesSchedule {
  const rng = createSeededRng(seed).fork('schedule');
  const seats = LIGHT_CYCLES_SEATS[count];
  return Array.from({ length: ticks }, () => {
    const turns: ScheduledTurn[] = [];
    while (rng.random() < density / (1 + density))
      turns.push({
        seat: rng.pick(seats),
        heading: rng.pick(LIGHT_CYCLES_HEADINGS),
      });
    return turns;
  });
}

/** Commands from bots for every seat, so rounds last and matches complete. */
export function playBots(
  config: LightCyclesConfig,
  initial: LightCyclesState,
  ticks: number,
  seed = 'bots'
): LightCyclesState[] {
  const bot = lightCyclesBotInput(config);
  const step = createLightCyclesStep(config);
  const states = [initial];
  for (let tick = 1; tick <= ticks; tick++) {
    const state = states.at(-1)!;
    const context = stepContext(config, seed, tick);
    const turns = state.seats.map((seat, index) => ({
      seat,
      heading: bot(state, seat, index % 2 === 0 ? 'hard' : 'easy', context)
        .heading,
    }));
    states.push(step(state, scheduledInputs(state, turns, tick), context));
  }
  return states;
}

/** The state after the countdown, with nobody moved yet. */
export function runningLightCycles(
  config: LightCyclesConfig,
  seats: readonly LightCyclesSeat[]
): LightCyclesState {
  const states = playLightCycles(
    config,
    seats,
    Array.from({ length: config.countdownTicks }, () => [])
  );
  return states.at(-1)!;
}
