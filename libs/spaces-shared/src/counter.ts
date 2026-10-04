import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import { createMessageNamespace, isPlainRecord } from '@pkgs/message-shared/message';
import { createMessageRouter } from '@pkgs/message-shared/router';
import type { MessageRouter } from '@pkgs/message-shared/router';
import type { HandleResult, RoomState } from '@pkgs/room-shared/types';
import type { GameCommandContext } from './game';

function validateEmptyPayload(p: unknown): p is Record<string, never> {
  return isPlainRecord(p) && Object.keys(p).length === 0;
}

const counterRoomNs = createAttrNamespace('counter');

/** Namespaced keys in {@link RoomState} for the space counter slice. */
export const CounterRoomAttr = {
  count: counterRoomNs.integer('count', (v): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0
  ),
} as const;

export const counterCmdNs = createMessageNamespace('counter-cmd');
export const Increment = counterCmdNs('increment', validateEmptyPayload);
export const Decrement = counterCmdNs('decrement', validateEmptyPayload);

export const counterEvtNs = createMessageNamespace('counter-evt');
export const CounterIncremented = counterEvtNs(
  'incremented',
  validateEmptyPayload
);
export const CounterDecremented = counterEvtNs(
  'decremented',
  validateEmptyPayload
);

function readCount(state: RoomState): number {
  return CounterRoomAttr.count.from(state);
}

/** Routes counter commands to the events that should be appended to the log. */
export const counterCommandRouter: MessageRouter<
  RoomState,
  GameCommandContext,
  HandleResult
> = createMessageRouter<RoomState, GameCommandContext, HandleResult>(
  counterCmdNs
)
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
