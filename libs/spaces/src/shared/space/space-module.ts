import {
  createComposedMessageRouter,
  isMessageEnvelope,
  type Message,
} from '@pkgs/message';
import {
  type HandleResult,
  hashRoomState,
  ROOM_ERROR_TYPE,
  type RoomCommand,
  type RoomError,
  type RoomModule,
  type RoomModuleName,
  type RoomState,
} from '@pkgs/room';

import {
  counterCmdNs,
  counterCommandRouter,
  counterEventReducer,
  counterEvtNs,
} from './counter';
import type { GameCommandContext, GameDefinition } from './game';
import {
  createGamesCommandRouter,
  createGamesEventReducer,
  gamesCmdNs,
  gamesEvtNs,
} from './games';
import {
  spaceLogCmdNs,
  spaceLogCommandRouter,
  spaceLogEventReducer,
  spaceLogEvtNs,
} from './space-log/space-log-messages';
import {
  createSpaceMembersEventReducer,
  SpaceMembersRoomAttr,
  spaceMembersCmdNs,
  spaceMembersCommandRouter,
  spaceMembersEvtNs,
} from './space-members/space-members-messages';

function reject(error: RoomError): HandleResult {
  return { ok: false, error };
}

function assertUniqueGameIds(games: readonly GameDefinition[]): void {
  const seen = new Set<string>();
  for (const game of games) {
    if (seen.has(game.id)) {
      throw new Error(`createSpaceModule: duplicate game id ${game.id}`);
    }
    seen.add(game.id);
  }
}

function buildCommandRouter(games: readonly GameDefinition[]) {
  return createComposedMessageRouter<
    RoomState,
    GameCommandContext,
    HandleResult
  >([
    { namespace: spaceLogCmdNs, router: spaceLogCommandRouter },
    { namespace: spaceMembersCmdNs, router: spaceMembersCommandRouter },
    { namespace: counterCmdNs, router: counterCommandRouter },
    { namespace: gamesCmdNs, router: createGamesCommandRouter(games) },
    ...games.flatMap((game) => [...game.commandRouters]),
  ]);
}

function buildEventReducer(
  games: readonly GameDefinition[],
  now: () => number
) {
  return createComposedMessageRouter<RoomState, void, RoomState>([
    { namespace: spaceLogEvtNs, router: spaceLogEventReducer },
    {
      namespace: spaceMembersEvtNs,
      router: createSpaceMembersEventReducer(now),
    },
    { namespace: counterEvtNs, router: counterEventReducer },
    { namespace: gamesEvtNs, router: createGamesEventReducer(games) },
    ...games.flatMap((game) => [...game.eventRouters]),
  ]);
}

function buildInitialState(games: readonly GameDefinition[]): RoomState {
  let state: RoomState = {
    ...SpaceMembersRoomAttr.seats({}),
  };
  for (const game of games) {
    if (game.initialState !== undefined) {
      state = { ...state, ...game.initialState() };
    }
  }
  return state;
}

/**
 * Builds the composed real-time state module for a space, given a registry
 * of games. The composition root (`apps/server/src/api.ts`) supplies the
 * registry; `@libs/spaces` never imports a specific game module.
 *
 * Adding a new game means dropping a `GameDefinition` into the registry —
 * this factory's body never changes.
 *
 * @param name — Wire id for the composed module (DO `module` query, uniqueness).
 */
export function createSpaceModule(
  name: RoomModuleName,
  games: readonly GameDefinition[],
  now: () => number
): RoomModule<RoomState, Message, Message, string> {
  assertUniqueGameIds(games);
  const commandRouter = buildCommandRouter(games);
  const eventReducer = buildEventReducer(games, now);

  return {
    name,
    initialState: (): RoomState => buildInitialState(games),

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
      return commandRouter.dispatch(
        state,
        { identity, ts: command.ts },
        msg,
        (_s, _c, m) =>
          reject({
            type: ROOM_ERROR_TYPE.invalidCommand,
            reason: String(m.type),
          })
      );
    },

    reduce(state: RoomState, event: Message): RoomState {
      const ev = isMessageEnvelope(event) ? event : null;
      if (ev === null) return state;
      return eventReducer.dispatch(state, undefined, ev, (s) => s);
    },

    hash(state: RoomState): string {
      return hashRoomState(state);
    },
  };
}
