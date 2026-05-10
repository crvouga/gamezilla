import {
  createComposedMessageRouter,
  isMessageEnvelope,
  type Message,
} from '@gamezilla/lib/message';
import {
  ROOM_ERROR_TYPE,
  type HandleResult,
  type RoomCommand,
  type RoomError,
  type RoomModule,
  type RoomState,
} from '@gamezilla/room';

import {
  chessCmdNs,
  chessEvtNs,
  chessMainMenuCommandRouter,
  chessMainMenuEventReducer,
} from '@gamezilla/chess/shared/chess-main-menu';
import {
  chessPuzzlePlayCmdNs,
  chessPuzzlePlayCommandRouter,
  chessPuzzlePlayEventReducer,
  chessPuzzlePlayEvtNs,
} from '@gamezilla/chess/shared/chess-puzzle-play';
import {
  chessPuzzleSessionCmdNs,
  chessPuzzleSessionCommandRouter,
  chessPuzzleSessionEventReducer,
  chessPuzzleSessionEvtNs,
} from '@gamezilla/chess/shared/chess-puzzle-session';
import {
  counterCmdNs,
  counterCommandRouter,
  counterEventReducer,
  counterEvtNs,
} from './counter';
import {
  gamesCmdNs,
  gamesCommandRouter,
  gamesEventReducer,
  gamesEvtNs,
} from './games';

function reject(error: RoomError): HandleResult {
  return { ok: false, error };
}

/**
 * Composed router across every sub-module's command namespace. Add new
 * sub-modules here and `dispatch` will route by wire prefix without a
 * `switch` ever touching this file again.
 */
const spaceCommandRouter = createComposedMessageRouter<
  RoomState,
  string,
  HandleResult
>([
  { namespace: counterCmdNs, router: counterCommandRouter },
  { namespace: gamesCmdNs, router: gamesCommandRouter },
  { namespace: chessCmdNs, router: chessMainMenuCommandRouter },
  {
    namespace: chessPuzzleSessionCmdNs,
    router: chessPuzzleSessionCommandRouter,
  },
  { namespace: chessPuzzlePlayCmdNs, router: chessPuzzlePlayCommandRouter },
]);

const spaceEventReducer = createComposedMessageRouter<
  RoomState,
  void,
  RoomState
>([
  { namespace: counterEvtNs, router: counterEventReducer },
  { namespace: gamesEvtNs, router: gamesEventReducer },
  { namespace: chessEvtNs, router: chessMainMenuEventReducer },
  {
    namespace: chessPuzzleSessionEvtNs,
    router: chessPuzzleSessionEventReducer,
  },
  { namespace: chessPuzzlePlayEvtNs, router: chessPuzzlePlayEventReducer },
]);

/**
 * Real-time multiplayer state for a single space entity. Composed from
 * sub-modules (currently just `counter`); the authoritative `Space`
 * Durable Object on the server runs this and clients mirror via `Room`
 * for offline-tolerant local dispatch + convergent replay.
 */
export const SpaceModule: RoomModule<RoomState, Message, Message, string> = {
  initialState(): RoomState {
    return {};
  },

  handle(
    state: RoomState,
    command: RoomCommand,
    identity: string
  ): HandleResult {
    const msg = isMessageEnvelope(command.payload) ? command.payload : null;
    if (msg === null) {
      return reject({
        type: ROOM_ERROR_TYPE.invalidCommand,
        reason: 'not a message envelope',
      });
    }
    return spaceCommandRouter.dispatch(state, identity, msg, (_s, _c, m) =>
      reject({
        type: ROOM_ERROR_TYPE.invalidCommand,
        reason: String(m.type),
      })
    );
  },

  reduce(state: RoomState, event: Message): RoomState {
    const ev = isMessageEnvelope(event) ? event : null;
    if (ev === null) return state;
    return spaceEventReducer.dispatch(state, undefined, ev, (s) => s);
  },
};
