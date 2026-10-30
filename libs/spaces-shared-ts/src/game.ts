import type { AppGrantKey } from '@libs/permissions-shared-ts/permission-catalog';
import type {
  Message,
  MessageNamespace,
} from '@pkgs/message-shared-ts/message';
import type { MessageRouter } from '@pkgs/message-shared-ts/router';
import type { ROOM_SERVICE_GRANT } from '@pkgs/room-root-shared-ts/service-identity';
import type {
  HandleResult,
  RoomEffect,
  RoomModule,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import type { GameAutomation } from '@pkgs/turn-game-shared-ts/game-automation';
import type { GamePresentation } from '@pkgs/turn-game-shared-ts/game-presentation';
import type {
  RegisteredGame,
  RegisteredTurnGame,
  TurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import type { Random } from '@pkgs/uuid-shared-ts/create-id';
import type { JSX } from 'solid-js';

/**
 * One sub-router contributed by a game to the composed space command/event
 * router. Mirrors the shape `createComposedMessageRouter` accepts.
 */
export type GameRouterEntry<TCtx, TReturn> = {
  readonly namespace: MessageNamespace;
  readonly router: MessageRouter<RoomState, TCtx, TReturn>;
};

/**
 * One router per namespace. A shared module and a game's own room may each
 * handle some messages of one durable namespace (the platform's puzzle
 * review and chess's developer tools both speak `chess-cmd`); their routers
 * become one that hands each message to the router that handles it. Two
 * routers handling the same message type are refused, naming it.
 */
export function mergeGameRouterEntries<TCtx, TReturn>(
  entries: readonly GameRouterEntry<TCtx, TReturn>[]
): GameRouterEntry<TCtx, TReturn>[] {
  const byPrefix = new Map<string, GameRouterEntry<TCtx, TReturn>[]>();
  for (const entry of entries) {
    const group = byPrefix.get(entry.namespace.prefix) ?? [];
    group.push(entry);
    byPrefix.set(entry.namespace.prefix, group);
  }
  return [...byPrefix.values()].map((group) =>
    group.length === 1
      ? group[0]!
      : {
          namespace: group[0]!.namespace,
          router: mergedRouter(group.map((entry) => entry.router)),
        }
  );
}

function mergedRouter<TCtx, TReturn>(
  routers: readonly MessageRouter<RoomState, TCtx, TReturn>[]
): MessageRouter<RoomState, TCtx, TReturn> {
  const handling = (msg: Message) => {
    const found = routers.filter((router) => router.has(msg));
    if (found.length > 1)
      throw new Error(
        `${msg.type} is handled by more than one game router — one module owns each message`
      );
    return found[0];
  };
  const merged: MessageRouter<RoomState, TCtx, TReturn> = {
    on() {
      throw new Error('a merged game router takes no further handlers');
    },
    dispatch(state, ctx, msg, fallback) {
      const router = handling(msg);
      return router === undefined
        ? fallback(state, ctx, msg)
        : router.dispatch(state, ctx, msg, fallback);
    },
    has: (msg) => handling(msg) !== undefined,
  };
  return merged;
}

/**
 * Context every game command handler receives from the composed space module.
 * `identity` is the room actor id; `ts` is the server-stamped commit time of
 * the command being handled (the only deterministic time source in a handler).
 */
export type GameCommandContext = {
  readonly identity: string;
  readonly ts: number;
  /** Stable command identity, retained when delivery repeats. */
  readonly commandId: string;
  readonly random: Random;
  /**
   * Whether the handler decides as the room's authority. A device predicting
   * its own command is not: a decision that needs what only the authority
   * holds (another person's private setup) waits for the room's answer.
   */
  readonly authority: boolean;
};

/**
 * A module the platform installs once in every space, whichever games use
 * it, bound to the rules of every registered turn game (the shared custom
 * games and match rooms). Games never name one: their registration
 * (`defineGame`) declares it, and the space installs it once.
 */
export type SharedGameModule = {
  readonly id: string;
  readonly bind: (rules: TurnGames) => GameDefinition;
};

/** The room behaviour of a game's own screens, beside the shared ones. */
export type GameOwnRoom = {
  /** Command sub-routers this game contributes (one per namespace). */
  readonly commandRouters: readonly GameRouterEntry<
    GameCommandContext,
    HandleResult
  >[];
  /** Event sub-routers this game contributes (one per namespace). */
  readonly eventRouters: readonly GameRouterEntry<void, RoomState>[];
  /** Attributes the game's reducers expect, merged into the space's initial state. */
  readonly initialState?: () => RoomState;
};

/**
 * Shared definition of a playable game inside a space. Implementations live
 * in game packages and are listed by the game registry (`GAME_DEFINITIONS`),
 * composed into the space room at the composition roots — `@libs/spaces`
 * itself never imports a specific game. A turn game is defined with
 * `defineGame`; the optional room hooks below are what shared modules
 * supply, never a game.
 */
export type GameDefinition = GameOwnRoom & {
  /** Stable wire id (e.g. `'chess'`). Mirrored in room state + URLs. */
  readonly id: string;
  readonly automation?: GameAutomation<never>;
  readonly turnGame?: RegisteredTurnGame;
  /** Authorable puzzles, independently of turn games and their rated feeds. */
  readonly puzzleContent?: PuzzleContent;
  /** Position, execution and offered product capabilities, shared by all game kinds. */
  readonly registration?: RegisteredGame;
  /** Shared framework execution on the room's existing authoritative connection. */
  readonly createRuntime?: RoomModule<
    RoomState,
    Message,
    Message,
    string
  >['createRuntime'];
  /** Shared modules the game is played through, installed once per space. */
  readonly sharedModules?: readonly SharedGameModule[];
  /** Independent rooms shared by spaces playing a matched game. */
  readonly matchRooms?: readonly RoomModule<
    RoomState,
    Message,
    Message,
    string
  >[];
  /** Host-device schedules recovered from its current local game. */
  readonly recoverLocalEffects?: (state: RoomState) => readonly RoomEffect[];
  /** Fix a locally chosen move in the durable command before delivery. */
  readonly prepareLocalCommand?: (
    state: RoomState,
    payload: Message,
    now: number,
    random: Random
  ) => Message;
  /**
   * Who may read one of the definition's events (`RoomModule.audience`):
   * `null` for everyone in the space, else the people it is private to.
   */
  readonly audience?: (event: Message) => readonly string[] | null;
  /** Recover idempotent effects from committed game state after a room restart. */
  readonly recoverEffects: (state: RoomState) => readonly RoomEffect[];
  /** Trusted room-host availability, distinct from participant presence. */
  readonly availabilityChange?: RoomModule<
    RoomState,
    Message,
    Message,
    string
  >['availabilityChange'];
  /** Domain reactions committed in the same room transaction as a space event. */
  readonly reactToSpaceEvent?: (
    state: RoomState,
    ctx: GameCommandContext,
    event: Message
  ) => HandleResult | null;
  /** Capability decision made for an incoming game command. */
  readonly permissionForCommand?: (
    command: Message,
    topic: string
  ) => {
    readonly key: AppGrantKey | typeof ROOM_SERVICE_GRANT;
    readonly reason: string;
  } | null;
};

export type GameClientMenuProps = {
  /** Called by the game's main menu when the user asks to return to the games picker. */
  onBackToGames: () => void;
};

/**
 * Client-side definition of a playable game. Composed alongside
 * {@link GameDefinition} at the composition root and provided to
 * `<GamesRegistryProvider>` so `<GamesMainMenu>` can render the game list
 * + mount the selected game's UI.
 */
export type GameClientDefinition = {
  readonly presentation?: GamePresentation<JSX.Element>;
  readonly id: string;
  /** Display title shown in the games picker (localized string or node). */
  readonly title: JSX.Element | string;
  /** One-line description under the title in the games picker. */
  readonly caption?: JSX.Element | string;
  /** Mounted when this game is the currently selected game in the space. */
  readonly MainMenu: (props: GameClientMenuProps) => JSX.Element;
  /** Account-owned effects observe open rooms even while another screen is shown. */
  readonly SessionEffects?: () => JSX.Element;
};
