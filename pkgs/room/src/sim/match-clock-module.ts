import { createAttrNamespace } from '@pkgs/attribute';
import {
  createMessageNamespace,
  isMessageEnvelope,
  isPlainRecord,
  type Message,
} from '@pkgs/message';

import { CancelScheduleEffect, ScheduleEffect } from '../effects/builtin';
import { hashRoomState } from '../hash-room-state';
import {
  assertRoomModuleName,
  type HandleResult,
  ROOM_ERROR_TYPE,
  type RoomCommand,
  type RoomModule,
  type RoomState,
} from '../types';

const ns = createAttrNamespace('match-clock');
const statusAttr = ns.text('status', (v): string =>
  typeof v === 'string' ? v : 'idle'
);
const turnAttr = ns.text('turn', (v): string =>
  typeof v === 'string' ? v : 'white'
);
const whiteMsAttr = ns.integer('white-ms', (v): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0
);
const blackMsAttr = ns.integer('black-ms', (v): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0
);
const turnStartedAtAttr = ns.integer('turn-started-at', (v): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0
);
const winnerAttr = ns.textOrNull('winner', (v): string | null =>
  typeof v === 'string' && v.length > 0 ? v : null
);

function isNonNegInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function isSeat(v: unknown): v is 'white' | 'black' {
  return v === 'white' || v === 'black';
}

const cmdNs = createMessageNamespace('match-clock-cmd');
const StartMatch = cmdNs(
  'start',
  (p): p is { whiteMs: number; blackMs: number } =>
    isPlainRecord(p) && isNonNegInt(p['whiteMs']) && isNonNegInt(p['blackMs'])
);
const Move = cmdNs(
  'move',
  (p): p is Record<string, never> =>
    isPlainRecord(p) && Object.keys(p).length === 0
);
const FlagFall = cmdNs(
  'flag-fall',
  (p): p is { seat: 'white' | 'black' } => isPlainRecord(p) && isSeat(p['seat'])
);

const evtNs = createMessageNamespace('match-clock-evt');
const MatchStarted = evtNs(
  'started',
  (
    p
  ): p is {
    whiteMs: number;
    blackMs: number;
    turnStartedAt: number;
  } =>
    isPlainRecord(p) &&
    isNonNegInt(p['whiteMs']) &&
    isNonNegInt(p['blackMs']) &&
    isNonNegInt(p['turnStartedAt'])
);
const TurnMoved = evtNs(
  'moved',
  (
    p
  ): p is {
    turn: 'white' | 'black';
    whiteMs: number;
    blackMs: number;
    turnStartedAt: number;
  } =>
    isPlainRecord(p) &&
    isSeat(p['turn']) &&
    isNonNegInt(p['whiteMs']) &&
    isNonNegInt(p['blackMs']) &&
    isNonNegInt(p['turnStartedAt'])
);
const Flagged = evtNs(
  'flagged',
  (p): p is { winner: 'white' | 'black' } =>
    isPlainRecord(p) && isSeat(p['winner'])
);

const FLAG_SCHEDULE_ID = 'match-clock:flag';

function rejectConflict(reason: string): HandleResult {
  return { ok: false, error: { type: ROOM_ERROR_TYPE.conflict, reason } };
}

function rejectInvalid(reason: string): HandleResult {
  return {
    ok: false,
    error: { type: ROOM_ERROR_TYPE.invalidCommand, reason },
  };
}

function remainingForTurn(state: RoomState): number {
  return turnAttr.from(state) === 'white'
    ? whiteMsAttr.from(state)
    : blackMsAttr.from(state);
}

function scheduleFlag(seat: 'white' | 'black', at: number): Message {
  return ScheduleEffect({
    id: FLAG_SCHEDULE_ID,
    at,
    payload: FlagFall({ seat }),
  });
}

function handleStart(
  command: RoomCommand,
  payload: { whiteMs: number; blackMs: number },
  status: string
): HandleResult {
  if (status !== 'idle') return rejectConflict('already started');
  return {
    ok: true,
    events: [
      MatchStarted({
        whiteMs: payload.whiteMs,
        blackMs: payload.blackMs,
        turnStartedAt: command.ts,
      }),
    ],
    effects: [
      CancelScheduleEffect({ id: FLAG_SCHEDULE_ID }),
      scheduleFlag('white', command.ts + payload.whiteMs),
    ],
  };
}

function handleMoveCmd(
  state: RoomState,
  command: RoomCommand,
  identity: string,
  status: string
): HandleResult {
  if (status !== 'playing') return rejectConflict(`status=${status}`);
  const turn = turnAttr.from(state) as 'white' | 'black';
  if (identity !== turn) return rejectConflict(`not ${turn}'s turn`);
  const bank = remainingForTurn(state);
  const elapsed = command.ts - turnStartedAtAttr.from(state);
  if (elapsed >= bank) return rejectConflict('flag already due');
  const left = bank - elapsed;
  const next: 'white' | 'black' = turn === 'white' ? 'black' : 'white';
  const whiteMs = turn === 'white' ? left : whiteMsAttr.from(state);
  const blackMs = turn === 'black' ? left : blackMsAttr.from(state);
  const nextBank = next === 'white' ? whiteMs : blackMs;
  return {
    ok: true,
    events: [
      TurnMoved({
        turn: next,
        whiteMs,
        blackMs,
        turnStartedAt: command.ts,
      }),
    ],
    effects: [
      CancelScheduleEffect({ id: FLAG_SCHEDULE_ID }),
      scheduleFlag(next, command.ts + nextBank),
    ],
  };
}

function handleFlag(
  state: RoomState,
  command: RoomCommand,
  seat: 'white' | 'black',
  status: string
): HandleResult {
  if (status !== 'playing') return rejectConflict(`status=${status}`);
  if (seat !== turnAttr.from(state)) return rejectConflict('wrong seat flag');
  const dueAt = turnStartedAtAttr.from(state) + remainingForTurn(state);
  if (command.ts < dueAt) return rejectConflict('flag early');
  const winner: 'white' | 'black' = seat === 'white' ? 'black' : 'white';
  return {
    ok: true,
    events: [Flagged({ winner })],
    effects: [CancelScheduleEffect({ id: FLAG_SCHEDULE_ID })],
  };
}

/**
 * Dual-bank match clock fixture: Start / Move arm Schedule(FlagFall);
 * FlagFall is terminal only when command.ts is past the active bank.
 */
export const MatchClockFixtureModule: RoomModule<
  RoomState,
  Message,
  Message,
  string
> = {
  name: assertRoomModuleName('match-clock-fixture'),
  initialState(): RoomState {
    return {
      ...statusAttr('idle'),
      ...turnAttr('white'),
      ...whiteMsAttr(0),
      ...blackMsAttr(0),
      ...turnStartedAtAttr(0),
      ...winnerAttr(null),
    };
  },

  handle(
    state: RoomState,
    command: RoomCommand,
    identity: string
  ): HandleResult {
    const msg = isMessageEnvelope(command.payload) ? command.payload : null;
    if (msg === null) return rejectInvalid('not a message envelope');
    const status = statusAttr.from(state);
    if (StartMatch.is(msg)) return handleStart(command, msg.payload, status);
    if (Move.is(msg)) return handleMoveCmd(state, command, identity, status);
    if (FlagFall.is(msg)) {
      return handleFlag(state, command, msg.payload.seat, status);
    }
    return rejectInvalid(String(msg.type));
  },

  reduce(state: RoomState, event: Message): RoomState {
    const ev = isMessageEnvelope(event) ? event : null;
    if (ev === null) return state;
    if (MatchStarted.is(ev)) {
      return {
        ...state,
        ...statusAttr('playing'),
        ...turnAttr('white'),
        ...whiteMsAttr(ev.payload.whiteMs),
        ...blackMsAttr(ev.payload.blackMs),
        ...turnStartedAtAttr(ev.payload.turnStartedAt),
        ...winnerAttr(null),
      };
    }
    if (TurnMoved.is(ev)) {
      return {
        ...state,
        ...turnAttr(ev.payload.turn),
        ...whiteMsAttr(ev.payload.whiteMs),
        ...blackMsAttr(ev.payload.blackMs),
        ...turnStartedAtAttr(ev.payload.turnStartedAt),
      };
    }
    if (Flagged.is(ev)) {
      return {
        ...state,
        ...statusAttr('flagged'),
        ...winnerAttr(ev.payload.winner),
      };
    }
    return state;
  },

  hash(state: RoomState): string {
    return hashRoomState(state);
  },
};

export {
  blackMsAttr,
  FlagFall,
  Move,
  StartMatch,
  statusAttr,
  turnAttr,
  turnStartedAtAttr,
  whiteMsAttr,
  winnerAttr,
};

export function matchClockStatus(state: RoomState): string {
  return statusAttr.from(state);
}

export function matchClockWinner(state: RoomState): string | null {
  return winnerAttr.from(state);
}

export function matchClockTurn(state: RoomState): string {
  return turnAttr.from(state);
}

export function matchClockWhiteMs(state: RoomState): number {
  return whiteMsAttr.from(state);
}

export function matchClockBlackMs(state: RoomState): number {
  return blackMsAttr.from(state);
}
