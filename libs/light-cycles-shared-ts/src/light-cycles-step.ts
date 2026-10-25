import type {
  SimulationInput,
  SimulationStep,
} from '@pkgs/turn-game-shared-ts/simulation';
import {
  type LightCyclesProposal,
  resolveMovement,
} from './light-cycles-collision';
import type { LightCyclesConfig } from './light-cycles-config';
import { isReversal, stepCell } from './light-cycles-heading';
import type { LightCyclesInput } from './light-cycles-input';
import {
  finishLightCyclesRound,
  startNextLightCyclesRound,
} from './light-cycles-round';
import {
  type LightCyclesCrash,
  type LightCyclesRider,
  type LightCyclesState,
  plannedHeading,
} from './light-cycles-state';

/** Queues one command by the rule; any command it refuses changes nothing. */
function queueTurn(
  rider: LightCyclesRider,
  input: LightCyclesInput,
  maxQueuedTurns: number
): LightCyclesRider {
  const planned = plannedHeading(rider);
  if (input.heading === planned || isReversal(planned, input.heading))
    return rider;
  if (rider.turns.length >= maxQueuedTurns) return rider;
  return { ...rider, turns: [...rider.turns, input.heading] };
}

function applyInputs(
  state: LightCyclesState,
  inputs: readonly SimulationInput<LightCyclesInput>[],
  config: LightCyclesConfig
): LightCyclesState {
  if (state.phase !== 'countdown' && state.phase !== 'running') return state;
  let riders = state.riders;
  for (const input of inputs) {
    if (input.value.round !== state.round) continue;
    const index = riders.findIndex((rider) => rider.seat === input.playerId);
    const rider = riders[index];
    if (rider === undefined || !rider.alive) continue;
    const queued = queueTurn(rider, input.value, config.maxQueuedTurns);
    if (queued !== rider) riders = riders.with(index, queued);
  }
  return riders === state.riders ? state : { ...state, riders };
}

/** Consumes at most one queued turn; a turn that would reverse is dropped. */
function turned(rider: LightCyclesRider): LightCyclesRider {
  const [next, ...rest] = rider.turns;
  if (next === undefined) return rider;
  return {
    ...rider,
    heading: isReversal(rider.heading, next) ? rider.heading : next,
    turns: rest,
  };
}

/** Every alive rider proposes exactly one cell; all proposals resolve together. */
function moveRiders(state: LightCyclesState): LightCyclesState {
  const steered = state.riders.map((rider) =>
    rider.alive ? turned(rider) : rider
  );
  const proposals = steered
    .filter((rider) => rider.alive)
    .map((rider): LightCyclesProposal => {
      const target = stepCell(rider, rider.heading);
      return { seat: rider.seat, x: target.x, y: target.y };
    });
  const movement = resolveMovement(state, proposals);
  const crashes: LightCyclesCrash[] = [];
  const riders = steered.map((rider) => {
    const outcome = movement.outcomes.find((item) => item.seat === rider.seat);
    if (outcome === undefined) return rider;
    if (outcome.crash === null) return { ...rider, x: outcome.x, y: outcome.y };
    crashes.push({
      seat: rider.seat,
      x: rider.x,
      y: rider.y,
      cause: outcome.crash,
    });
    return { ...rider, alive: false, turns: [] };
  });
  return {
    ...state,
    trails: movement.trails,
    riders,
    crashes:
      crashes.length === 0 ? state.crashes : [...state.crashes, ...crashes],
  };
}

function advanceCountdown(
  state: LightCyclesState,
  config: LightCyclesConfig
): LightCyclesState {
  const phaseTick = state.phaseTick + 1;
  return phaseTick >= config.countdownTicks
    ? { ...state, phase: 'running', phaseTick: 0 }
    : { ...state, phaseTick };
}

function advanceRunning(
  state: LightCyclesState,
  config: LightCyclesConfig
): LightCyclesState {
  const phaseTick = state.phaseTick + 1;
  const ticked = { ...state, phaseTick };
  if (phaseTick % config.movementTicks !== 0) return ticked;
  return finishLightCyclesRound(moveRiders(ticked));
}

function advanceRoundOver(
  state: LightCyclesState,
  config: LightCyclesConfig
): LightCyclesState {
  const phaseTick = state.phaseTick + 1;
  return phaseTick >= config.roundOverTicks
    ? startNextLightCyclesRound(state, config)
    : { ...state, phaseTick };
}

/** Light Cycles owns only mechanics; the fixed-step engine owns time and input order. */
export function createLightCyclesStep(
  config: LightCyclesConfig
): SimulationStep<LightCyclesState, LightCyclesInput> {
  return (state, inputs) => {
    const commanded = applyInputs(state, inputs, config);
    switch (commanded.phase) {
      case 'countdown':
        return advanceCountdown(commanded, config);
      case 'running':
        return advanceRunning(commanded, config);
      case 'round-over':
        return advanceRoundOver(commanded, config);
      case 'completed':
        return commanded;
    }
  };
}
