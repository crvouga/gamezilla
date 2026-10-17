import type { AppGrantKey } from '@libs/permissions-shared/permission-catalog';
import type { Message, MessageNamespace } from '@pkgs/message-shared/message';
import type { MessageRouter } from '@pkgs/message-shared/router';
import type {
  HandleResult,
  RoomEffect,
  RoomModule,
  RoomState,
} from '@pkgs/room-root-shared/types';
import type { GameAutomation } from '@pkgs/turn-game-shared/game-automation';
import type { GamePresentation } from '@pkgs/turn-game-shared/game-presentation';
import type {
  RegisteredTurnGame,
  TurnGames,
} from '@pkgs/turn-game-shared/game-rules';
import type { Random } from '@pkgs/uuid-shared/create-id';
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
};

/**
 * A module the platform installs once in every space, whichever games use
 * it, bound to the rules of every registered turn game (the shared custom
 * games and match rooms). Games never name one: their registration
 * (`defineTurnGame`) declares it, and the space installs it once.
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
 * `defineTurnGame`; the optional room hooks below are what shared modules
 * supply, never a game.
 */
export type GameDefinition = GameOwnRoom & {
  /** Stable wire id (e.g. `'chess'`). Mirrored in room state + URLs. */
  readonly id: string;
  readonly automation?: GameAutomation<never>;
  readonly turnGame?: RegisteredTurnGame;
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
    command: Message
  ) => { readonly key: AppGrantKey; readonly reason: string } | null;
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
