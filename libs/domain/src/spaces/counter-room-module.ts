import {
  createNamespace,
  isPlainRecord,
  type Message,
} from '@gamezilla/lib/message';
import type {
  HandleResult,
  RoomCommand,
  RoomError,
  RoomModule,
  RoomState,
} from '@gamezilla/room';

function validateEmptyPayload(p: unknown): p is Record<string, never> {
  return isPlainRecord(p) && Object.keys(p).length === 0;
}

const cmdNs = createNamespace('spaceCounterCmd');
export const Increment = cmdNs('INCREMENT', validateEmptyPayload);
export const Decrement = cmdNs('DECREMENT', validateEmptyPayload);

const evtNs = createNamespace('spaceCounterEvt');
export const CounterIncremented = evtNs(
  'COUNTER_INCREMENTED',
  validateEmptyPayload
);
export const CounterDecremented = evtNs(
  'COUNTER_DECREMENTED',
  validateEmptyPayload
);

function reject(error: RoomError): HandleResult {
  return { ok: false, error };
}

function readCount(state: RoomState): number {
  const c = state['count'];
  return typeof c === 'number' && Number.isFinite(c) ? c : 0;
}

function asMessage(payload: unknown): Message | null {
  if (typeof payload !== 'object' || payload === null) return null;
  if (!('type' in payload) || !('payload' in payload)) return null;
  return payload as Message;
}

export const CounterModule: RoomModule<
  RoomState,
  unknown,
  unknown,
  string
> = {
  initialState(): RoomState {
    return { count: 0 };
  },

  handle(
    _state: RoomState,
    command: RoomCommand,
    _identity: string
  ): HandleResult {
    void _identity;
    const msg = asMessage(command.payload);
    if (msg === null) {
      return reject({
        type: 'invalid_command',
        reason: 'not a message envelope',
      });
    }
    if (Increment.is(msg)) {
      return { ok: true, events: [CounterIncremented({})] };
    }
    if (Decrement.is(msg)) {
      return { ok: true, events: [CounterDecremented({})] };
    }
    return reject({
      type: 'invalid_command',
      reason: String(msg.type),
    });
  },

  reduce(state: RoomState, event: unknown): RoomState {
    const ev = asMessage(event);
    if (ev === null) return state;
    if (CounterIncremented.is(ev)) {
      return { ...state, count: readCount(state) + 1 };
    }
    if (CounterDecremented.is(ev)) {
      return { ...state, count: readCount(state) - 1 };
    }
    return state;
  },
};
