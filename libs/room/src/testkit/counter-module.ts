import { createAttrNamespace } from '@gamezilla/lib/attribute';
import {
  createMessageNamespace,
  isPlainRecord,
  type Message,
} from '@gamezilla/lib/message';

import type {
  HandleResult,
  RoomCommand,
  RoomModule,
  RoomState,
} from '../types';

function validateEmptyPayload(p: unknown): p is Record<string, never> {
  return isPlainRecord(p) && Object.keys(p).length === 0;
}

const counterRoomNs = createAttrNamespace('counter');
const counterCount = counterRoomNs('count', (v): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0
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

function asMessage(payload: unknown): Message | null {
  if (typeof payload !== 'object' || payload === null) return null;
  if (!('type' in payload) || !('payload' in payload)) return null;
  return payload as Message;
}

/** Minimal counter module for tests (mirrors domain counter shape). */
export const TestCounterModule: RoomModule<
  RoomState,
  unknown,
  unknown,
  string
> = {
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
    const msg = asMessage(command.payload);
    if (msg === null) {
      return {
        ok: false,
        error: { type: 'invalid_command', reason: 'not a message envelope' },
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
        type: 'invalid_command',
        reason: String(msg.type),
      },
    };
  },

  reduce(state: RoomState, event: unknown): RoomState {
    const ev = asMessage(event);
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

export { Decrement, Increment };
