import { createAttrNamespace } from '@pkgs/attribute';
import {
  createMessageNamespace,
  isMessageEnvelope,
  isPlainRecord,
  type Message,
} from '@pkgs/message';

import { hashRoomState } from '../../hash-room-state';
import {
  assertRoomModuleName,
  type HandleResult,
  ROOM_ERROR_TYPE,
  type RoomCommand,
  type RoomModule,
  type RoomState,
} from '../../types';

const ns = createAttrNamespace('deadline');
const statusAttr = ns.text('status', (v): string =>
  typeof v === 'string' ? v : 'idle'
);
const deadlineAtAttr = ns.integer('deadline-at', (v): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0
);
const outcomeAttr = ns.textOrNull('outcome', (v): string | null =>
  typeof v === 'string' && v.length > 0 ? v : null
);

function isNonNegInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

const cmdNs = createMessageNamespace('deadline-cmd');
const StartDeadline = cmdNs(
  'start',
  (p): p is { durationMs: number } =>
    isPlainRecord(p) && isNonNegInt(p['durationMs'])
);
const ActBeforeDeadline = cmdNs(
  'act',
  (p): p is Record<string, never> =>
    isPlainRecord(p) && Object.keys(p).length === 0
);
const ExpireDeadline = cmdNs(
  'expire',
  (p): p is Record<string, never> =>
    isPlainRecord(p) && Object.keys(p).length === 0
);

const evtNs = createMessageNamespace('deadline-evt');
const DeadlineStarted = evtNs(
  'started',
  (p): p is { deadlineAt: number } =>
    isPlainRecord(p) && isNonNegInt(p['deadlineAt'])
);
const DeadlineWon = evtNs(
  'won',
  (p): p is Record<string, never> =>
    isPlainRecord(p) && Object.keys(p).length === 0
);
const DeadlineExpired = evtNs(
  'expired',
  (p): p is Record<string, never> =>
    isPlainRecord(p) && Object.keys(p).length === 0
);

function readStatus(state: RoomState): string {
  return statusAttr.from(state);
}

function readDeadlineAt(state: RoomState): number {
  return deadlineAtAttr.from(state);
}

function rejectConflict(reason: string): HandleResult {
  return { ok: false, error: { type: ROOM_ERROR_TYPE.conflict, reason } };
}

function rejectInvalid(reason: string): HandleResult {
  return {
    ok: false,
    error: { type: ROOM_ERROR_TYPE.invalidCommand, reason },
  };
}

/**
 * Fixture module for M6/M7: start a deadline, then race Act vs Expire.
 * Time comes from `command.ts` (scenario-driven); no Io in handle.
 */
export const DeadlineFixtureModule: RoomModule<
  RoomState,
  Message,
  Message,
  string
> = {
  name: assertRoomModuleName('deadline-fixture'),
  initialState(): RoomState {
    return {
      ...statusAttr('idle'),
      ...deadlineAtAttr(0),
      ...outcomeAttr(null),
    };
  },

  handle(state: RoomState, command: RoomCommand): HandleResult {
    const msg = isMessageEnvelope(command.payload) ? command.payload : null;
    if (msg === null) return rejectInvalid('not a message envelope');
    const status = readStatus(state);

    if (StartDeadline.is(msg)) {
      if (status !== 'idle') return rejectConflict('already started');
      return {
        ok: true,
        events: [
          DeadlineStarted({ deadlineAt: command.ts + msg.payload.durationMs }),
        ],
      };
    }
    if (ActBeforeDeadline.is(msg)) {
      if (status !== 'open') return rejectConflict(`status=${status}`);
      if (command.ts >= readDeadlineAt(state)) {
        return rejectConflict('deadline passed');
      }
      return { ok: true, events: [DeadlineWon({})] };
    }
    if (ExpireDeadline.is(msg)) {
      if (status !== 'open') return rejectConflict(`status=${status}`);
      if (command.ts < readDeadlineAt(state)) {
        return rejectConflict('deadline not reached');
      }
      return { ok: true, events: [DeadlineExpired({})] };
    }
    return rejectInvalid(String(msg.type));
  },

  reduce(state: RoomState, event: Message): RoomState {
    const ev = isMessageEnvelope(event) ? event : null;
    if (ev === null) return state;
    if (DeadlineStarted.is(ev)) {
      return {
        ...state,
        ...statusAttr('open'),
        ...deadlineAtAttr(ev.payload.deadlineAt),
        ...outcomeAttr(null),
      };
    }
    if (DeadlineWon.is(ev)) {
      return { ...state, ...statusAttr('won'), ...outcomeAttr('won') };
    }
    if (DeadlineExpired.is(ev)) {
      return {
        ...state,
        ...statusAttr('expired'),
        ...outcomeAttr('expired'),
      };
    }
    return state;
  },

  hash(state: RoomState): string {
    return hashRoomState(state);
  },
};

export {
  ActBeforeDeadline,
  deadlineAtAttr,
  ExpireDeadline,
  outcomeAttr,
  StartDeadline,
  statusAttr,
};

export function deadlineStatus(state: RoomState): string {
  return readStatus(state);
}

export function deadlineOutcome(state: RoomState): string | null {
  return outcomeAttr.from(state);
}

export function deadlineAt(state: RoomState): number {
  return readDeadlineAt(state);
}
