import {
  createMessageRouter,
  createNamespace,
  isPlainRecord,
  type MessageRouter,
} from '@gamezilla/lib/message';
import type { HandleResult, RoomState } from '@gamezilla/room';

function validateEmptyPayload(p: unknown): p is Record<string, never> {
  return isPlainRecord(p) && Object.keys(p).length === 0;
}

export const counterCmdNs = createNamespace('spaceCounterCmd');
export const Increment = counterCmdNs('INCREMENT', validateEmptyPayload);
export const Decrement = counterCmdNs('DECREMENT', validateEmptyPayload);

export const counterEvtNs = createNamespace('spaceCounterEvt');
export const CounterIncremented = counterEvtNs(
  'COUNTER_INCREMENTED',
  validateEmptyPayload
);
export const CounterDecremented = counterEvtNs(
  'COUNTER_DECREMENTED',
  validateEmptyPayload
);

function readCount(state: RoomState): number {
  const c = state['count'];
  return typeof c === 'number' && Number.isFinite(c) ? c : 0;
}

/**
 * Counter sub-module of {@link SpaceModule}: owns the `count` slice of room state.
 * Exposed as namespaced message routers so the parent space module can compose
 * it via {@link createComposedMessageRouter} alongside other future sub-modules.
 */
export function counterInitialState(): RoomState {
  return { count: 0 };
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
export const counterEventReducer: MessageRouter<
  RoomState,
  void,
  RoomState
> = createMessageRouter<RoomState, void, RoomState>(counterEvtNs)
  .on(CounterIncremented, (state) => ({
    ...state,
    count: readCount(state) + 1,
  }))
  .on(CounterDecremented, (state) => ({
    ...state,
    count: readCount(state) - 1,
  }));
