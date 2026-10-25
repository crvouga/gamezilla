import type { SimulationCodec } from '@pkgs/turn-game-shared-ts/simulation';
import {
  LIGHT_CYCLES_SEAT_ORDER,
  LIGHT_CYCLES_SEATS,
  type LightCyclesConfig,
  type LightCyclesSeat,
} from './light-cycles-config';
import type { LightCyclesHeading } from './light-cycles-heading';
import { decodeTrailRuns, encodeTrailRuns } from './light-cycles-rle';
import type {
  LightCyclesCrash,
  LightCyclesCrashCause,
  LightCyclesPhase,
  LightCyclesResult,
  LightCyclesRider,
  LightCyclesState,
} from './light-cycles-state';
import { isValidLightCyclesState } from './light-cycles-validate';

/**
 * `L1;width;height;target;maxRounds;riders;phase;phaseTick;round;scores;
 * roundWinner;result;riders;crashes;trailRuns` — every field a canonical
 * token, so one state has exactly one encoding.
 */
const VERSION = 'L1';
const FIELDS = 15;
const PHASES: Readonly<Record<LightCyclesPhase, string>> = {
  countdown: 'c',
  running: 'r',
  'round-over': 'o',
  completed: 'x',
};
const HEADINGS: Readonly<Record<LightCyclesHeading, string>> = {
  up: 'U',
  right: 'R',
  down: 'D',
  left: 'L',
};
const CAUSES: Readonly<Record<LightCyclesCrashCause, string>> = {
  wall: 'w',
  trail: 't',
  contested: 'c',
  retired: 'r',
};
const REASONS: Readonly<Record<LightCyclesResult['reason'], string>> = {
  'target score': 't',
  'round limit': 'l',
};

function invert<K extends string>(
  table: Readonly<Record<K, string>>
): ReadonlyMap<string, K> {
  return new Map(
    Object.entries(table).map(([key, token]) => [token as string, key as K])
  );
}

const PHASE_TOKENS = invert(PHASES);
const HEADING_TOKENS = invert(HEADINGS);
const CAUSE_TOKENS = invert(CAUSES);
const REASON_TOKENS = invert(REASONS);

function seatToken(seat: LightCyclesSeat | 'draw' | null): string {
  if (seat === null) return '-';
  return seat === 'draw' ? 'd' : String(LIGHT_CYCLES_SEAT_ORDER.indexOf(seat));
}

function encodeRider(rider: LightCyclesRider): string {
  const turns = rider.turns.map((turn) => HEADINGS[turn]).join('');
  return `${rider.x},${rider.y},${HEADINGS[rider.heading]}${rider.alive ? 1 : 0}${turns}`;
}

function encodeCrash(crash: LightCyclesCrash): string {
  return `${seatToken(crash.seat)},${crash.x},${crash.y},${CAUSES[crash.cause]}`;
}

function encodeState(state: LightCyclesState): string {
  const result =
    state.result === null
      ? '-'
      : `${seatToken(state.result.winner)}${REASONS[state.result.reason]}`;
  return [
    VERSION,
    state.width,
    state.height,
    state.targetScore,
    state.maxRounds,
    state.seats.length,
    PHASES[state.phase],
    state.phaseTick,
    state.round,
    state.scores.join(','),
    seatToken(state.roundWinner),
    result,
    state.riders.map(encodeRider).join('/'),
    state.crashes.map(encodeCrash).join('/'),
    encodeTrailRuns(state.trails),
  ].join(';');
}

/** A canonical non-negative safe integer, or null. */
function natural(token: string | undefined): number | null {
  if (token === undefined || !/^(0|[1-9][0-9]*)$/.test(token)) return null;
  const value = Number(token);
  return Number.isSafeInteger(value) ? value : null;
}

function seatOf(
  token: string | undefined,
  seats: readonly LightCyclesSeat[]
): LightCyclesSeat | null {
  const index = natural(token);
  return index === null ? null : (seats[index] ?? null);
}

function decodeWinner(
  token: string,
  seats: readonly LightCyclesSeat[]
): LightCyclesSeat | 'draw' | null | undefined {
  if (token === '-') return null;
  if (token === 'd') return 'draw';
  return seatOf(token, seats) ?? undefined;
}

function decodeResult(
  token: string,
  seats: readonly LightCyclesSeat[]
): LightCyclesResult | null | undefined {
  if (token === '-') return null;
  const winner = decodeWinner(token.slice(0, -1), seats);
  const reason = REASON_TOKENS.get(token.slice(-1));
  if (winner === null || winner === undefined || reason === undefined)
    return undefined;
  return { winner, reason };
}

function decodeTurns(token: string): LightCyclesHeading[] | null {
  const turns: LightCyclesHeading[] = [];
  for (const char of token) {
    const turn = HEADING_TOKENS.get(char);
    if (turn === undefined) return null;
    turns.push(turn);
  }
  return turns;
}

function decodeRider(
  token: string,
  seat: LightCyclesSeat
): LightCyclesRider | null {
  const match = /^([0-9]+),([0-9]+),([URDL])([01])([URDL]*)$/.exec(token);
  if (match === null) return null;
  const x = natural(match[1]);
  const y = natural(match[2]);
  const heading = HEADING_TOKENS.get(match[3]!);
  const turns = decodeTurns(match[5]!);
  if (x === null || y === null || heading === undefined || turns === null)
    return null;
  return { seat, x, y, heading, alive: match[4] === '1', turns };
}

function decodeCrash(
  token: string,
  seats: readonly LightCyclesSeat[]
): LightCyclesCrash | null {
  const [seatIndex, xToken, yToken, causeToken, ...rest] = token.split(',');
  const seat = seatOf(seatIndex, seats);
  const x = natural(xToken);
  const y = natural(yToken);
  const cause = CAUSE_TOKENS.get(causeToken ?? '');
  if (rest.length > 0 || seat === null || x === null || y === null) return null;
  return cause === undefined ? null : { seat, x, y, cause };
}

function decodeList<T>(
  token: string,
  decodeItem: (item: string, index: number) => T | null
): T[] | null {
  if (token === '') return [];
  const items: T[] = [];
  for (const [index, item] of token.split('/').entries()) {
    const decoded = decodeItem(item, index);
    if (decoded === null) return null;
    items.push(decoded);
  }
  return items;
}

function decodeSeats(token: string | undefined): readonly LightCyclesSeat[] {
  const count = natural(token);
  return count === 2 || count === 3 || count === 4
    ? LIGHT_CYCLES_SEATS[count]
    : [];
}

function decodeFields(
  fields: readonly string[],
  config: LightCyclesConfig
): LightCyclesState | null {
  const [, width, height, target, maxRounds, count, , tick, round] =
    fields.map(natural);
  const seats = decodeSeats(fields[5]);
  const riders = decodeList(fields[12]!, (item, index) =>
    seats[index] === undefined ? null : decodeRider(item, seats[index])
  );
  const crashes = decodeList(fields[13]!, (item) => decodeCrash(item, seats));
  const scores = fields[9]!.split(',').map(natural);
  const roundWinner = decodeWinner(fields[10]!, seats);
  const result = decodeResult(fields[11]!, seats);
  const trails = decodeTrailRuns(fields[14]!, config.width * config.height);
  const phaseName = PHASE_TOKENS.get(fields[6]!);
  if (
    fields[0] !== VERSION ||
    [width, height, target, maxRounds, count, tick, round].includes(null) ||
    seats.length === 0 ||
    riders === null ||
    crashes === null ||
    scores.includes(null) ||
    roundWinner === undefined ||
    result === undefined ||
    trails === null ||
    phaseName === undefined
  )
    return null;
  return {
    seats,
    width: width!,
    height: height!,
    phase: phaseName,
    phaseTick: tick!,
    round: round!,
    trails,
    riders,
    scores: scores as number[],
    targetScore: target!,
    maxRounds: maxRounds!,
    roundWinner,
    result,
    crashes,
  };
}

/** One canonical, compact and strictly validated representation for checkpoints and snapshots. */
export function lightCyclesCodec(
  config: LightCyclesConfig
): SimulationCodec<LightCyclesState> {
  return {
    encode: (state) => {
      if (!isValidLightCyclesState(state, config))
        throw new Error('refusing to encode an invalid Light Cycles state');
      return encodeState(state);
    },
    decode: (encoded) => {
      const fields = encoded.split(';');
      if (fields.length !== FIELDS) return null;
      const state = decodeFields(fields, config);
      return state !== null && isValidLightCyclesState(state, config)
        ? state
        : null;
    },
  };
}
