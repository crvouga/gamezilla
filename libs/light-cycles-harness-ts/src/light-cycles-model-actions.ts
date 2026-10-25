import { SubmitSimulationInput } from '@libs/game-session-shared-ts/simulation-messages';
import { LIGHT_CYCLES_CONFIG } from '@libs/light-cycles-shared-ts/light-cycles-config';
import {
  type LightCyclesHeading,
  oppositeHeading,
} from '@libs/light-cycles-shared-ts/light-cycles-heading';
import {
  type LightCyclesState,
  lightCyclesRider,
  plannedHeading,
} from '@libs/light-cycles-shared-ts/light-cycles-state';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { defineProperty } from '@pkgs/harness-root-shared-ts/define-property';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import { ROOM_VIRTUAL_RUNTIME } from '@pkgs/room-root-harness-ts/boot';
import {
  createModelArena,
  MODEL_MOVEMENT_TICKS,
  MODEL_RIDERS,
  MODEL_WATCHER,
  type ModelArena,
  type ModelPerson,
  type ModelRider,
  refreshModelArena,
  tickModelArena,
} from './light-cycles-model-arena';

const FORGED_SEQUENCE_BASE = 1_000_000;

function seated(arena: ModelArena, rider: ModelRider): boolean {
  return arena.arena.seats.includes(MODEL_RIDERS[rider].seat);
}

/**
 * Whether the authority will queue this turn at its next tick, read from the
 * arena the watcher holds. It only decides when to let that tick pass, so
 * each accepted turn shows before the next step; the observation is still
 * the authority's.
 */
function turnQueues(
  state: LightCyclesState,
  rider: ModelRider,
  heading: LightCyclesHeading
): boolean {
  const current = lightCyclesRider(state, MODEL_RIDERS[rider].seat);
  if (current === null || !current.alive) return false;
  if (state.phase !== 'countdown' && state.phase !== 'running') return false;
  const planned = plannedHeading(current);
  return (
    current.turns.length < LIGHT_CYCLES_CONFIG.maxQueuedTurns &&
    heading !== planned &&
    heading !== oppositeHeading(planned)
  );
}

/** A tick that would move the riders or end the countdown is not free. */
function nextTickIsFree(state: LightCyclesState): boolean {
  if (state.phase === 'countdown')
    return state.phaseTick + 1 < LIGHT_CYCLES_CONFIG.countdownTicks;
  return (state.phaseTick + 1) % MODEL_MOVEMENT_TICKS !== 0;
}

/** A command over the person's own connection that the authority must refuse. */
async function sendRefused(
  arena: ModelArena,
  person: ModelPerson,
  rider: ModelRider,
  value: { readonly round: number; readonly heading: string }
): Promise<void> {
  const latest = arena.peers.get(MODEL_WATCHER)!.latest;
  arena.forged += 1;
  const id = arena.kit.clients
    .get(person)!
    .room()!
    .sendSignal(
      SubmitSimulationInput({
        version: 1,
        epoch: latest?.epoch ?? 'no-game',
        playerId: MODEL_RIDERS[rider].seat,
        sequence: FORGED_SEQUENCE_BASE + arena.forged,
        tick: latest?.tick ?? 0,
        value,
      })
    );
  await arena.kit.drain();
  if (id === null)
    arena.problems.push(`${person}'s device could not send its turn`);
  else if (!arena.tap.rejections.some((item) => item.commandId === id))
    arena.problems.push(
      `${person}'s ${value.heading} for ${rider} in round ${value.round} was not refused`
    );
}

/**
 * A person chooses a turn. A rider's own person steers through their
 * device's replica; anyone else's choice goes over their own connection.
 */
export const steerModelRider = defineAction({
  name: 'steerModelRider',
  act: async (
    arena: ModelArena,
    person: ModelPerson,
    rider: ModelRider,
    heading: LightCyclesHeading
  ) => {
    const state = arena.arena;
    const value = { round: state.round, heading };
    if (MODEL_RIDERS[rider].person !== person || !seated(arena, rider)) {
      await sendRefused(arena, person, rider, value);
    } else {
      const sent = arena.peers
        .get(person)!
        .replica.control(MODEL_RIDERS[rider].seat, value);
      await arena.kit.drain();
      if (turnQueues(state, rider, heading)) {
        if (!sent)
          arena.problems.push(`${person}'s device did not send the turn`);
        if (!nextTickIsFree(state))
          throw new Error('no tick is left before the step to apply the turn');
        await tickModelArena(arena);
      }
    }
    await refreshModelArena(arena);
  },
});

/** A turn stamped with an earlier round, or sent after the game finished. */
export const sendLateTurn = defineAction({
  name: 'sendLateTurn',
  act: async (
    arena: ModelArena,
    person: ModelPerson,
    rider: ModelRider,
    heading: LightCyclesHeading
  ) => {
    const state = arena.arena;
    const round = state.phase === 'completed' ? state.round : state.round - 1;
    if (round < 1) throw new Error('round 1 has no earlier round');
    await sendRefused(arena, person, rider, { round, heading });
    await refreshModelArena(arena);
  },
});

async function tickUntil(arena: ModelArena, ticks: number): Promise<void> {
  for (let tick = 0; tick < ticks; tick++) await tickModelArena(arena);
  await refreshModelArena(arena);
}

/** Game time runs to the end of the 3-second countdown. */
export const endCountdown = defineAction({
  name: 'endCountdown',
  act: (arena: ModelArena) =>
    tickUntil(
      arena,
      LIGHT_CYCLES_CONFIG.countdownTicks - arena.arena.phaseTick
    ),
});

/** Game time runs to the riders' next movement step. */
export const takeRidersStep = defineAction({
  name: 'takeRidersStep',
  act: (arena: ModelArena) =>
    tickUntil(
      arena,
      MODEL_MOVEMENT_TICKS - (arena.arena.phaseTick % MODEL_MOVEMENT_TICKS)
    ),
});

/** Game time runs through the 2-second round result to the next countdown. */
export const endRoundResult = defineAction({
  name: 'endRoundResult',
  act: (arena: ModelArena) =>
    tickUntil(
      arena,
      LIGHT_CYCLES_CONFIG.roundOverTicks - arena.arena.phaseTick
    ),
});

/** Seconds pass once the game is finished. */
export const passSeconds = defineAction({
  name: 'passSeconds',
  act: async (arena: ModelArena, seconds: number) => {
    await arena.kit.runFor(seconds * 1000);
    await refreshModelArena(arena);
  },
});

/** Every refused turn was refused by the authority, and no tick passed unplanned. */
export const modelArenaKeepsTime = defineProperty({
  name: 'model-arena-keeps-time',
  check: (arena: ModelArena) => {
    if (arena.problems.length > 0) throw new Error(arena.problems.join('\n'));
  },
});

export const lightCyclesModelArena = defineSystem({
  name: 'light-cycles-model-arena',
  args: { game: 'duel' as 'duel' | 'trio', target: 1 },
  runtimes: [ROOM_VIRTUAL_RUNTIME],
  create: createModelArena,
  actions: [
    steerModelRider,
    sendLateTurn,
    endCountdown,
    takeRidersStep,
    endRoundResult,
    passSeconds,
  ],
  properties: [modelArenaKeepsTime],
});
