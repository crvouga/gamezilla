import {
  CHESS_TURN_GAMES,
  chessGameShared,
} from '@libs/chess-sub-shared-ts/chess-game';
import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import { mergeGameRouterEntries } from '@libs/spaces-shared-ts/game';
import type { Message } from '@pkgs/message-shared-ts/message';
import { isMessageEnvelope } from '@pkgs/message-shared-ts/message';
import { createComposedMessageRouter } from '@pkgs/message-shared-ts/router';
import { defineRoomModule } from '@pkgs/room-root-shared-ts/module';
import type {
  HandleResult,
  RoomCommand,
  RoomError,
  RoomModule,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import type { Random } from '@pkgs/uuid-shared-ts/create-id';

function reject(error: RoomError): HandleResult {
  return { ok: false, error };
}

/**
 * Chess as its registration installs it: its own room and every shared
 * module it declares (the custom games and the puzzle session), bound to
 * chess's rules alone.
 */
const modules = [
  chessGameShared,
  ...chessGameShared.sharedModules.map((module) =>
    module.bind(CHESS_TURN_GAMES)
  ),
];

const commandRouter = createComposedMessageRouter<
  RoomState,
  GameCommandContext,
  HandleResult
>(mergeGameRouterEntries(modules.flatMap((module) => module.commandRouters)));

const eventReducer = createComposedMessageRouter<RoomState, void, RoomState>(
  mergeGameRouterEntries(modules.flatMap((module) => module.eventRouters))
);

/**
 * Chess in a room: the room modules chess's registration installs (its own
 * screens, the custom games and the puzzle session), without the rest of a
 * space. Used by chess's puzzle tests and pins.
 *
 * Production traffic always goes through the composed `SpaceModule` built
 * by `createSpaceModule(name, [chessGameShared, …])` at the composition root.
 */
export function createChessModule(
  random: Random
): RoomModule<RoomState, Message, Message, string> {
  return defineRoomModule<RoomState, Message, Message, string>({
    name: 'chess',
    initialState(): RoomState {
      return modules.reduce<RoomState>(
        (state, module) => ({ ...state, ...(module.initialState?.() ?? {}) }),
        {}
      );
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
        {
          identity,
          ts: command.ts,
          commandId: command.id,
          random,
          authority: true,
        },
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
  });
}
