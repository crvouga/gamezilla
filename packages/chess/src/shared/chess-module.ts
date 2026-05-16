import {
  createComposedMessageRouter,
  isMessageEnvelope,
  type Message,
} from '@gamezilla/lib/message';
import {
  assertRoomModuleName,
  ROOM_ERROR_TYPE,
  type HandleResult,
  type RoomCommand,
  type RoomError,
  type RoomModule,
  type RoomState,
} from '@gamezilla/room';

import { chessGameShared } from './chess-game';

function reject(error: RoomError): HandleResult {
  return { ok: false, error };
}

const commandRouter = createComposedMessageRouter<
  RoomState,
  string,
  HandleResult
>(
  chessGameShared.commandRouters.map((entry) => ({
    namespace: entry.namespace,
    router: entry.router,
  }))
);

const eventReducer = createComposedMessageRouter<RoomState, void, RoomState>(
  chessGameShared.eventRouters.map((entry) => ({
    namespace: entry.namespace,
    router: entry.router,
  }))
);

/**
 * Self-contained chess RoomModule built only from chess's own routers. Used
 * by chess tests so they exercise the chess FSMs without importing
 * `@gamezilla/spaces` (which would re-introduce a chess <-> spaces cycle).
 *
 * Production traffic always goes through the composed `SpaceModule` built
 * by `createSpaceModule(name, [chessGameShared, …])` at the composition root.
 */
export const ChessModule: RoomModule<RoomState, Message, Message, string> = {
  name: assertRoomModuleName('chess'),
  initialState(): RoomState {
    if (chessGameShared.initialState === undefined) return {};
    return chessGameShared.initialState();
  },

  handle(state, command: RoomCommand, identity): HandleResult {
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
};
