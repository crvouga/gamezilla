import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import type { Message } from '@pkgs/message-shared-ts/message';
import { isMessageEnvelope } from '@pkgs/message-shared-ts/message';
import { createComposedMessageRouter } from '@pkgs/message-shared-ts/router';
import { defineRoomModule } from '@pkgs/room-root-shared-ts/module';
import type {
  HandleResult,
  RoomCommand,
  RoomEffect,
  RoomError,
  RoomModule,
  RoomModuleName,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import type { Random } from '@pkgs/uuid-shared-ts/create-id';
import {
  counterCmdNs,
  counterCommandRouter,
  counterEventReducer,
  counterEvtNs,
} from './counter';
import type { GameCommandContext, GameDefinition } from './game';
import { mergeGameRouterEntries } from './game';
import { gameModules } from './game-modules';
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
  SpaceQuietRoomAttr,
  spaceQuietCmdNs,
  spaceQuietCommandRouter,
  spaceQuietEventReducer,
  spaceQuietEvtNs,
} from './space-quiet';
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

/** What a space module is built with. */
export type SpaceModulePorts = {
  readonly now: () => number;
  readonly random: Random;
  /** Whether the module decides as the room's authority (the room itself, not a device). */
  readonly authority: boolean;
};

/** Who may read an event, when some game keeps events private. */
function composedAudience(
  games: readonly GameDefinition[]
): Pick<RoomModule<RoomState, Message, Message, string>, 'audience'> {
  const deciders = games.flatMap((game) =>
    game.audience === undefined ? [] : [game.audience]
  );
  if (deciders.length === 0) return {};
  return {
    audience: (event) => {
      for (const decide of deciders) {
        const audience = decide(event);
        if (audience !== null) return audience;
      }
      return null;
    },
  };
}

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

function buildCommandRouter(
  games: readonly GameDefinition[],
  modules: readonly GameDefinition[]
) {
  return createComposedMessageRouter<
    RoomState,
    GameCommandContext,
    HandleResult
  >([
    { namespace: spaceServiceCmdNs, router: spaceServiceCommandRouter },
    { namespace: spaceActivityCmdNs, router: spaceActivityCommandRouter },
    { namespace: spaceLogCmdNs, router: spaceLogCommandRouter },
    { namespace: spaceQuietCmdNs, router: spaceQuietCommandRouter },
    { namespace: counterCmdNs, router: counterCommandRouter },
    { namespace: gamesCmdNs, router: createGamesCommandRouter(games) },
    ...mergeGameRouterEntries(modules.flatMap((game) => game.commandRouters)),
  ]);
}

function buildEventReducer(
  now: () => number,
  modules: readonly GameDefinition[]
) {
  return createComposedMessageRouter<RoomState, void, RoomState>([
    { namespace: spaceLogEvtNs, router: spaceLogEventReducer },
    { namespace: spaceActivityEvtNs, router: spaceActivityEventReducer },
    { namespace: spaceQuietEvtNs, router: spaceQuietEventReducer },
    {
      namespace: spaceMembersEvtNs,
      router: createSpaceMembersEventReducer(now),
    },
    { namespace: counterEvtNs, router: counterEventReducer },
    { namespace: gamesEvtNs, router: createGamesEventReducer() },
    ...mergeGameRouterEntries(modules.flatMap((game) => game.eventRouters)),
  ]);
}

function buildInitialState(games: readonly GameDefinition[]): RoomState {
  let state: RoomState = {
    ...SpaceMembersRoomAttr.seats({}),
    ...SpaceMembersRoomAttr.ended(false),
    ...SpaceQuietRoomAttr.quiet({}),
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
 * of games. The composition root (`apps/server-ts/src/api.ts`) supplies the
 * registry; `@libs/spaces` never imports a specific game module.
 *
 * Adding a new game means dropping a `GameDefinition` into the registry —
 * this factory's body never changes.
 *
 * @param name — Wire id for the composed module (DO `module` query, uniqueness).
 */
function composedRuntime(
  games: readonly GameDefinition[]
): Pick<SpaceModule, 'createRuntime'> {
  const live = games.flatMap((game) =>
    game.createRuntime === undefined ? [] : [game.createRuntime]
  );
  if (live.length > 1)
    throw new Error('one shared execution owns the space room');
  return live[0] === undefined ? {} : { createRuntime: live[0] };
}

export function createSpaceModule(
  name: RoomModuleName,
  definitions: readonly GameDefinition[],
  ports: SpaceModulePorts
): SpaceModule {
  const { now, random, authority } = ports;
  assertUniqueGameIds(definitions);
  const games = gameModules(definitions);
  const commandRouter = buildCommandRouter(definitions, games);
  const eventReducer = buildEventReducer(now, games);
  const reduce = (state: RoomState, event: Message): RoomState =>
    eventReducer.dispatch(state, undefined, event, (s) => s);

  return {
    ...defineRoomModule<RoomState, Message, Message, string>({
      name,
      ...composedRuntime(games),
      ...composedAudience(games),
      connectionView: (grants) => {
        if (grants.includes(PERMISSION.spacesSelectGame))
          return { mode: 'authority' };
        return grants.includes(PERMISSION.spacesLeave)
          ? { mode: 'dependent-read', reason: 'the host is offline' }
          : { mode: 'presence', reason: 'not in the space' };
      },
      initialState: (): RoomState => buildInitialState(games),
      recoverEffects: (state) =>
        games.flatMap((game) => [...game.recoverEffects(state)]),
      availabilityChange(state, available, at) {
        const events: Message[] = [];
        const effects: RoomEffect[] = [];
        let current = state;
        for (const game of games) {
          const change = game.availabilityChange?.(current, available, at);
          if (change === null || change === undefined) continue;
          for (const event of change.events) {
            events.push(event);
            current = reduce(current, event);
          }
          effects.push(...(change.effects ?? []));
        }
        return events.length === 0 ? null : { events, effects };
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
        const ctx = {
          identity,
          ts: command.ts,
          commandId: command.id,
          random,
          authority,
        };
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

      presenceCommand: spacePresenceCommand,
    }),
    recoverLocalEffects: (state) =>
      games.flatMap((game) => [...(game.recoverLocalEffects?.(state) ?? [])]),
    prepareLocalCommand: (state, payload, at) =>
      games.reduce(
        (command, game) =>
          game.prepareLocalCommand?.(state, command, at, random) ?? command,
        payload
      ),
  };
}
