import { createAttrNamespace } from '@pkgs/attribute';
import {
  createMessageNamespace,
  isMessageEnvelope,
  isPlainRecord,
  type Message,
} from '@pkgs/message';

import {
  assertRoomModuleName,
  type HandleResult,
  ROOM_ERROR_TYPE,
  type RoomCommand,
  type RoomModule,
  type RoomState,
} from '../types';

function validateEmptyPayload(p: unknown): p is Record<string, never> {
  return isPlainRecord(p) && Object.keys(p).length === 0;
}

const counterRoomNs = createAttrNamespace('counter');
const counterCount = counterRoomNs.integer('count', (v): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0
);

const cmdNs = createMessageNamespace('space-counter-cmd');
const Increment = cmdNs('increment', validateEmptyPayload);
const Decrement = cmdNs('decrement', validateEmptyPayload);

const evtNs = createMessageNamespace('space-counter-evt');
const CounterIncremented = evtNs('counter-incremented', validateEmptyPayload);
const CounterDecremented = evtNs('counter-decremented', validateEmptyPayload);

function readCount(state: RoomState): number {
  return counterCount.from(state);
}

/** Minimal counter module for tests (mirrors domain counter shape). */
export const TestCounterModule: RoomModule<
  RoomState,
  Message,
  Message,
  string
> = {
  name: assertRoomModuleName('test-counter'),
  initialState(): RoomState {
    return counterCount(0);
  },

  handle(
    state: RoomState,
    command: RoomCommand,
    _identity: string
  ): HandleResult {
    void state;
    void _identity;
    const msg = isMessageEnvelope(command.payload) ? command.payload : null;
    if (msg === null) {
      return {
        ok: false,
        error: {
          type: ROOM_ERROR_TYPE.invalidCommand,
          reason: 'not a message envelope',
        },
      };
    }
    if (Increment.is(msg)) {
      return { ok: true, events: [CounterIncremented({})] };
    }
    if (Decrement.is(msg)) {
      return { ok: true, events: [CounterDecremented({})] };
    }
    return {
      ok: false,
      error: {
        type: ROOM_ERROR_TYPE.invalidCommand,
        reason: String(msg.type),
      },
    };
  },

  reduce(state: RoomState, event: Message): RoomState {
    const ev = isMessageEnvelope(event) ? event : null;
    if (ev === null) return state;
    if (CounterIncremented.is(ev)) {
      return { ...state, ...counterCount(readCount(state) + 1) };
    }
    if (CounterDecremented.is(ev)) {
      return { ...state, ...counterCount(readCount(state) - 1) };
    }
    return state;
  },
};

export { CounterDecremented, CounterIncremented, Decrement, Increment };
