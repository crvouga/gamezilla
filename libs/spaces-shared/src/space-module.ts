import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import type { Message } from '@pkgs/message-shared/message';
import { isMessageEnvelope } from '@pkgs/message-shared/message';
import { createComposedMessageRouter } from '@pkgs/message-shared/router';
import { hashRoomState } from '@pkgs/room-root-shared/hash-room-state';
import type {
  HandleResult,
  RoomCommand,
  RoomEffect,
  RoomError,
  RoomModule,
  RoomModuleName,
  RoomState,
} from '@pkgs/room-root-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
import type { Random } from '@pkgs/uuid-shared/create-id';
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
  spaceActivityCmdNs,
  spaceActivityCommandRouter,
  spaceActivityEventReducer,
  spaceActivityEvtNs,
} from './space-activity';
import {
  spaceLogCmdNs,
  spaceLogCommandRouter,
  spaceLogEventReducer,
  spaceLogEvtNs,
} from './space-log-messages';
import {
  createSpaceMembersEventReducer,
  SpaceMembersRoomAttr,
  spaceMembersEvtNs,
} from './space-members-messages';
import {
  spacePresenceCommand,
  spaceServiceCmdNs,
  spaceServiceCommandRouter,
} from './space-service-command';

export type SpaceModule = RoomModule<RoomState, Message, Message, string> & {
  readonly recoverLocalEffects: (state: RoomState) => readonly RoomEffect[];
  readonly prepareLocalCommand: (
    state: RoomState,
    payload: Message,
    now: number
  ) => Message;
};

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
    { namespace: spaceServiceCmdNs, router: spaceServiceCommandRouter },
    { namespace: spaceActivityCmdNs, router: spaceActivityCommandRouter },
    { namespace: spaceLogCmdNs, router: spaceLogCommandRouter },
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
    { namespace: spaceActivityEvtNs, router: spaceActivityEventReducer },
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
    ...SpaceMembersRoomAttr.ended(false),
  };
  for (const game of games) {
    if (game.initialState !== undefined) {
      state = { ...state, ...game.initialState() };
    }
  }
  return state;
}

function appendGameReactions(input: {
  readonly state: RoomState;
  readonly result: HandleResult;
  readonly ctx: GameCommandContext;
  readonly games: readonly GameDefinition[];
  readonly reduce: (state: RoomState, event: Message) => RoomState;
}): HandleResult {
  if (!input.result.ok) return input.result;
  const events: Message[] = [];
  const effects = [...(input.result.effects ?? [])];
  let state = input.state;
  for (const event of input.result.events) {
    events.push(event);
    state = input.reduce(state, event);
    for (const game of input.games) {
      const reaction = game.reactToSpaceEvent?.(state, input.ctx, event);
      if (reaction === null || reaction === undefined) continue;
      if (!reaction.ok) return reaction;
      effects.push(...(reaction.effects ?? []));
      for (const fact of reaction.events) {
        events.push(fact);
        state = input.reduce(state, fact);
      }
    }
  }
  return { ok: true, events, effects };
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
  now: () => number,
  random: Random
): SpaceModule {
  assertUniqueGameIds(games);
  const commandRouter = buildCommandRouter(games);
  const eventReducer = buildEventReducer(games, now);
  const reduce = (state: RoomState, event: Message): RoomState =>
    eventReducer.dispatch(state, undefined, event, (s) => s);

  return {
    name,
    connectionView: (grants) => {
      if (grants.includes(PERMISSION.spacesSelectGame))
        return { mode: 'authority' };
      return grants.includes(PERMISSION.spacesLeave)
        ? { mode: 'dependent', reason: 'the host is offline' }
        : { mode: 'presence', reason: 'not in the space' };
    },
    initialState: (): RoomState => buildInitialState(games),
    recoverLocalEffects: (state) =>
      games.flatMap((game) => [...(game.recoverLocalEffects?.(state) ?? [])]),
    prepareLocalCommand: (state, payload, at) =>
      games.reduce(
        (command, game) =>
          game.prepareLocalCommand?.(state, command, at, random) ?? command,
        payload
      ),
    recoverEffects: (state) =>
      games.flatMap((game) => [...game.recoverEffects(state)]),

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
      const ctx = { identity, ts: command.ts, commandId: command.id, random };
      const result = commandRouter.dispatch(state, ctx, msg, (_s, _c, m) =>
        reject({
          type: ROOM_ERROR_TYPE.invalidCommand,
          reason: String(m.type),
        })
      );
      return appendGameReactions({ state, result, ctx, games, reduce });
    },

    reduce(state: RoomState, event: Message): RoomState {
      const ev = isMessageEnvelope(event) ? event : null;
      if (ev === null) return state;
      return reduce(state, ev);
    },

    hash(state: RoomState): string {
      return hashRoomState(state);
    },

    presenceCommand: spacePresenceCommand,
  };
}
