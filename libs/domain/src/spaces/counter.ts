import { createAttrNamespace } from '@gamezilla/lib/attribute';
import {
  createMessageNamespace,
  createMessageRouter,
  isPlainRecord,
  type MessageRouter,
} from '@gamezilla/lib/message';
import type { HandleResult, RoomState } from '@gamezilla/room';

function validateEmptyPayload(p: unknown): p is Record<string, never> {
  return isPlainRecord(p) && Object.keys(p).length === 0;
}

const counterRoomNs = createAttrNamespace('counter');

/** Namespaced keys in {@link RoomState} for the space counter slice. */
export const CounterRoomAttr = {
  count: counterRoomNs('count', (v): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : 0
  ),
} as const;

export const counterCmdNs = createMessageNamespace('counterCmd');
export const Increment = counterCmdNs('INCREMENT', validateEmptyPayload);
export const Decrement = counterCmdNs('DECREMENT', validateEmptyPayload);

export const counterEvtNs = createMessageNamespace('counterEvt');
export const CounterIncremented = counterEvtNs(
  'INCREMENTED',
  validateEmptyPayload
);
export const CounterDecremented = counterEvtNs(
  'DECREMENTED',
  validateEmptyPayload
);

function readCount(state: RoomState): number {
  return CounterRoomAttr.count.from(state);
}

/** Routes counter commands to the events that should be appended to the log. */
export const counterCommandRouter: MessageRouter<
  RoomState,
  string,
  HandleResult
> = createMessageRouter<RoomState, string, HandleResult>(counterCmdNs)
  .on(Increment, () => ({ ok: true, events: [CounterIncremented({})] }))
  .on(Decrement, () => ({ ok: true, events: [CounterDecremented({})] }));

/** Routes counter events back into updates of the `count` slice. */
export const counterEventReducer: MessageRouter<RoomState, void, RoomState> =
  createMessageRouter<RoomState, void, RoomState>(counterEvtNs)
    .on(CounterIncremented, (state) => ({
      ...state,
      ...CounterRoomAttr.count(readCount(state) + 1),
    }))
    .on(CounterDecremented, (state) => ({
      ...state,
      ...CounterRoomAttr.count(readCount(state) - 1),
    }));
