import {
  type LightCyclesConfig,
  lightCyclesSeatLayout,
} from './light-cycles-config';
import { isReversal } from './light-cycles-heading';
import { lightCyclesLeader } from './light-cycles-round';
import {
  EMPTY_CELL,
  type LightCyclesRider,
  type LightCyclesState,
  lightCyclesRoundStart,
  trailMark,
} from './light-cycles-state';

function count(value: number, minimum: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function validShape(state: LightCyclesState, config: LightCyclesConfig) {
  const seats = state.seats;
  if (lightCyclesSeatLayout(seats) === null) return false;
  const marks = new Set([EMPTY_CELL, ...seats.map(trailMark)]);
  return (
    state.width === config.width &&
    state.height === config.height &&
    state.targetScore === config.targetScore &&
    state.maxRounds === config.maxRounds &&
    count(state.round, 1, config.maxRounds) &&
    count(state.phaseTick, 0, Number.MAX_SAFE_INTEGER) &&
    state.riders.length === seats.length &&
    state.riders.every((rider, index) => rider.seat === seats[index]) &&
    state.scores.length === seats.length &&
    state.scores.every((score) => count(score, 0, config.targetScore)) &&
    state.trails.length === config.width * config.height &&
    [...state.trails].every((cell) => marks.has(cell))
  );
}

/** Each queued turn is neither a repeat nor a reversal of the heading before it. */
function validTurns(rider: LightCyclesRider, maxQueuedTurns: number): boolean {
  if (rider.turns.length > maxQueuedTurns) return false;
  if (!rider.alive && rider.turns.length > 0) return false;
  let previous = rider.heading;
  for (const turn of rider.turns) {
    if (turn === previous || isReversal(previous, turn)) return false;
    previous = turn;
  }
  return true;
}

/** Every rider sits on a cell of its own trail, so alive riders never share one. */
function validRiders(state: LightCyclesState, config: LightCyclesConfig) {
  const cells = new Set<number>();
  for (const rider of state.riders) {
    if (!count(rider.x, 0, state.width - 1)) return false;
    if (!count(rider.y, 0, state.height - 1)) return false;
    const index = rider.y * state.width + rider.x;
    if (state.trails[index] !== trailMark(rider.seat)) return false;
    if (rider.alive && cells.has(index)) return false;
    if (rider.alive) cells.add(index);
    if (!validTurns(rider, config.maxQueuedTurns)) return false;
  }
  return true;
}

/** Exactly the eliminated riders appear, once each, where they stopped. */
function validCrashes(state: LightCyclesState): boolean {
  const seen = new Set<string>();
  for (const crash of state.crashes) {
    const rider = state.riders.find((item) => item.seat === crash.seat);
    if (rider === undefined || rider.alive || seen.has(crash.seat))
      return false;
    if (rider.x !== crash.x || rider.y !== crash.y) return false;
    if (state.phase === 'countdown' && crash.cause !== 'retired') return false;
    seen.add(crash.seat);
  }
  return state.riders.every((rider) => rider.alive || seen.has(rider.seat));
}

function validScores(state: LightCyclesState): boolean {
  const total = state.scores.reduce((sum, score) => sum + score, 0);
  const finished =
    state.phase === 'round-over' || state.phase === 'completed'
      ? state.round
      : state.round - 1;
  if (total > finished) return false;
  if (state.phase === 'completed') return true;
  return state.scores.every((score) => score < state.targetScore);
}

/** A countdown arena is exactly the round's spawns, with nobody moved yet. */
function validCountdown(state: LightCyclesState, config: LightCyclesConfig) {
  const start = lightCyclesRoundStart(state.seats, config, state.round);
  return (
    state.phaseTick < config.countdownTicks &&
    state.trails === start.trails &&
    state.riders.every((rider, index) => {
      const spawn = start.riders[index]!;
      return (
        rider.x === spawn.x &&
        rider.y === spawn.y &&
        rider.heading === spawn.heading
      );
    })
  );
}

function validRoundWinner(state: LightCyclesState): boolean {
  const alive = state.riders.filter((rider) => rider.alive);
  if (alive.length > 1) return false;
  if (state.riders.some((rider) => rider.turns.length > 0)) return false;
  const winner = alive.length === 1 ? alive[0]!.seat : 'draw';
  return state.roundWinner === winner;
}

function validResult(state: LightCyclesState): boolean {
  const result = state.result;
  if (result === null || state.phaseTick !== 0) return false;
  if (result.reason === 'round limit')
    return (
      state.round === state.maxRounds &&
      state.scores.every((score) => score < state.targetScore) &&
      result.winner === lightCyclesLeader(state)
    );
  return (
    result.winner !== 'draw' &&
    result.winner === state.roundWinner &&
    state.scores[state.seats.indexOf(result.winner)] === state.targetScore
  );
}

function validPhase(state: LightCyclesState, config: LightCyclesConfig) {
  const playing = state.phase === 'countdown' || state.phase === 'running';
  if (playing) {
    if (state.result !== null) return false;
    if ((state.roundWinner === null) !== (state.round === 1)) return false;
    return state.phase === 'running' || validCountdown(state, config);
  }
  if (!validRoundWinner(state)) return false;
  if (state.phase === 'completed') return validResult(state);
  return (
    state.result === null &&
    state.round < state.maxRounds &&
    state.phaseTick < config.roundOverTicks
  );
}

/** Whether `state` is structurally sound and consistent with `config`. */
export function isValidLightCyclesState(
  state: LightCyclesState,
  config: LightCyclesConfig
): boolean {
  return (
    validShape(state, config) &&
    validRiders(state, config) &&
    validCrashes(state) &&
    validScores(state) &&
    validPhase(state, config)
  );
}
