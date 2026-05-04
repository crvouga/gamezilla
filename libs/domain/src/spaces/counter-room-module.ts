import { createNamespace, isPlainRecord } from '@gamezilla/lib/message';
import type {
  Command,
  Event,
  HandleResult,
  RoomError,
  RoomModule,
  State,
} from '@gamezilla/room';

function validateEmptyPayload(p: unknown): p is Record<string, never> {
  return isPlainRecord(p) && Object.keys(p).length === 0;
}

function validateErrUnknownCommand(p: unknown): p is { commandType: string } {
  if (!isPlainRecord(p)) return false;
  const t = p['commandType'];
  return typeof t === 'string' && t.length > 0;
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

const errNs = createNamespace('spaceCounterErr');
const UnknownCommandError = errNs('UNKNOWN_COMMAND', validateErrUnknownCommand);

function reject(error: RoomError): HandleResult {
  return { ok: false, error };
}

function readCount(state: State): number {
  const c = state['count'];
  return typeof c === 'number' && Number.isFinite(c) ? c : 0;
}

export const CounterModule: RoomModule = {
  initialState(): State {
    return { count: 0 };
  },

  handle(_state: State, command: Command): HandleResult {
    const msg = command.message;
    if (Increment.is(msg)) {
      return { ok: true, events: [CounterIncremented({})] };
    }
    if (Decrement.is(msg)) {
      return { ok: true, events: [CounterDecremented({})] };
    }
    return reject(
      UnknownCommandError({
        commandType: typeof msg.type === 'string' ? msg.type : '?',
      })
    );
  },

  reduce(state: State, event: Event): State {
    if (CounterIncremented.is(event)) {
      return { ...state, count: readCount(state) + 1 };
    }
    if (CounterDecremented.is(event)) {
      return { ...state, count: readCount(state) - 1 };
    }
    return state;
  },
};
