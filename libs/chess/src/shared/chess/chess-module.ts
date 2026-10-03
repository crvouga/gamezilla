import type { GameCommandContext } from '@libs/spaces/public/game';
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
import type { Random } from '@pkgs/uuid';

import { chessPuzzleGame } from './chess-game';

function reject(error: RoomError): HandleResult {
  return { ok: false, error };
}

const commandRouter = createComposedMessageRouter<
  RoomState,
  GameCommandContext,
  HandleResult
>(
  chessPuzzleGame.commandRouters.map((entry) => ({
    namespace: entry.namespace,
    router: entry.router,
  }))
);

const eventReducer = createComposedMessageRouter<RoomState, void, RoomState>(
  chessPuzzleGame.eventRouters.map((entry) => ({
    namespace: entry.namespace,
    router: entry.router,
  }))
);

/**
 * Self-contained chess RoomModule built only from chess's own routers. Used
 * by chess tests so they exercise the chess FSMs without importing
 * `@libs/spaces` (which would re-introduce a chess <-> spaces cycle).
 *
 * Production traffic always goes through the composed `SpaceModule` built
 * by `createSpaceModule(name, [chessPuzzleGame, …])` at the composition root.
 */
export function createChessModule(
  random: Random
): RoomModule<RoomState, Message, Message, string> {
  return {
    name: assertRoomModuleName('chess'),
    recoverEffects: (state) => chessPuzzleGame.recoverEffects(state),
    initialState(): RoomState {
      if (chessPuzzleGame.initialState === undefined) return {};
      return chessPuzzleGame.initialState();
    },

    handle(state, command: RoomCommand, identity): HandleResult {
      const msg = isMessageEnvelope(command.payload) ? command.payload : null;
      if (msg === null) {
        return reject({
          type: ROOM_ERROR_TYPE.invalidCommand,
          reason: 'not a message envelope',
        });
      }
      return commandRouter.dispatch(
        state,
        { identity, ts: command.ts, commandId: command.id, random },
        msg,
        (_s, _c, m) =>
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
}
