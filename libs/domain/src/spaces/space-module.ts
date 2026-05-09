import {
  createComposedMessageRouter,
  type Message,
} from '@gamezilla/lib/message';
import type {
  HandleResult,
  RoomCommand,
  RoomError,
  RoomModule,
  RoomState,
} from '@gamezilla/room';

import {
  CounterRoomAttr,
  counterCmdNs,
  counterCommandRouter,
  counterEventReducer,
  counterEvtNs,
} from './counter';
import {
  CHESS_SCREEN,
  ChessMainMenuScreenAttr,
  chessCmdNs,
  chessEvtNs,
  chessMainMenuCommandRouter,
  chessMainMenuEventReducer,
} from './games/chess/chess-main-menu';
import {
  ChessPuzzleSessionAttr,
  chessPuzzleSessionCmdNs,
  chessPuzzleSessionCommandRouter,
  chessPuzzleSessionEventReducer,
  chessPuzzleSessionEvtNs,
} from './games/chess/puzzle/chess-puzzle-session';
import {
  GamesRoomAttr,
  gamesCmdNs,
  gamesCommandRouter,
  gamesEventReducer,
  gamesEvtNs,
} from './games/games';

function reject(error: RoomError): HandleResult {
  return { ok: false, error };
}

function asMessage(payload: unknown): Message | null {
  if (typeof payload !== 'object' || payload === null) return null;
  if (!('type' in payload) || !('payload' in payload)) return null;
  return payload as Message;
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
]);

/**
 * Real-time multiplayer state for a single space entity. Composed from
 * sub-modules (currently just `counter`); the authoritative `Space`
 * Durable Object on the server runs this and clients mirror via `Room`
 * for offline-tolerant local dispatch + convergent replay.
 */
export const SpaceModule: RoomModule<RoomState, unknown, unknown, string> = {
  initialState(): RoomState {
    return {
      ...CounterRoomAttr.count(0),
      ...GamesRoomAttr.selected(null),
      ...ChessMainMenuScreenAttr.screen(CHESS_SCREEN.root),
      ...ChessPuzzleSessionAttr.selectedPuzzleId(null),
    };
  },

  handle(
    state: RoomState,
    command: RoomCommand,
    identity: string
  ): HandleResult {
    const msg = asMessage(command.payload);
    if (msg === null) {
      return reject({
        type: 'invalid_command',
        reason: 'not a message envelope',
      });
    }
    return spaceCommandRouter.dispatch(state, identity, msg, (_s, _c, m) =>
      reject({ type: 'invalid_command', reason: String(m.type) })
    );
  },

  reduce(state: RoomState, event: unknown): RoomState {
    const ev = asMessage(event);
    if (ev === null) return state;
    return spaceEventReducer.dispatch(state, undefined, ev, (s) => s);
  },
};
