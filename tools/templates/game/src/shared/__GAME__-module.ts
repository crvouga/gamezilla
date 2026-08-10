import {
  createComposedMessageRouter,
  isMessageEnvelope,
  type Message,
} from '@pkgs/message';
import {
  assertRoomModuleName,
  type HandleResult,
  hashRoomState,
  ROOM_ERROR_TYPE,
  type RoomCommand,
  type RoomError,
  type RoomModule,
  type RoomState,
} from '@pkgs/room';

function reject(error: RoomError): HandleResult {
  return { ok: false, error };
}

const commandRouter = createComposedMessageRouter<
  RoomState,
  string,
  HandleResult
>([]);

const eventReducer = createComposedMessageRouter<RoomState, void, RoomState>(
  []
);

/**
 * Standalone RoomModule for tests. Production traffic goes through the
 * composed space module registered in `@libs/spaces`.
 */
export const __GAME_PASCAL__Module: RoomModule<
  RoomState,
  Message,
  Message,
  string
> = {
  name: assertRoomModuleName('__GAME__'),
  initialState(): RoomState {
    return {};
  },

  handle(state, command: RoomCommand, identity): HandleResult {
    void state;
    void identity;
    const msg = isMessageEnvelope(command.payload) ? command.payload : null;
    if (msg === null) {
      return reject({
        type: ROOM_ERROR_TYPE.invalidCommand,
        reason: 'not a message envelope',
      });
    }
    return commandRouter.dispatch(state, identity, msg, (_s, _c, m) =>
      reject({
        type: ROOM_ERROR_TYPE.invalidCommand,
        reason: String(m.type),
      })
    );
  },

  reduce(state, event: Message): RoomState {
    const ev = isMessageEnvelope(event) ? event : null;
    if (ev === null) return state;
    return eventReducer.dispatch(state, undefined, ev, (s) => s);
  },

  hash(state): string {
    return hashRoomState(state);
  },
};
