import type { MessageNamespace, MessageRouter } from '@pkgs/message';
import type { HandleResult, RoomState } from '@pkgs/room';
import type { ComponentType, ReactNode } from 'react';
import type { LogLineContext, LogLineDraft } from '@pkgs/collab';

/**
 * One sub-router contributed by a game to the composed space command/event
 * router. Mirrors the shape `createComposedMessageRouter` accepts.
 */
export type GameRouterEntry<TCtx, TReturn> = {
  readonly namespace: MessageNamespace;
  readonly router: MessageRouter<RoomState, TCtx, TReturn>;
};

export type GameDescribeRouterEntry = {
  readonly namespace: MessageNamespace;
  readonly router: MessageRouter<void, LogLineContext, LogLineDraft | null>;
};

/**
 * Shared definition of a playable game inside a space. Implementations live
 * in feature packages (e.g. `@libs/chess/shared/chess-game`) and are
 * wired into the composed `SpaceModule` at the composition root
 * (`apps/api/src/api.ts`) — `@libs/spaces` itself never imports a
 * specific game.
 */
export type GameDefinition = {
  /** Stable wire id (e.g. `'chess'`). Mirrored in room state + URLs. */
  readonly id: string;
  /** Command sub-routers this game contributes (one per namespace). */
  readonly commandRouters: readonly GameRouterEntry<string, HandleResult>[];
  /** Event sub-routers this game contributes (one per namespace). */
  readonly eventRouters: readonly GameRouterEntry<void, RoomState>[];
  /**
   * Optional event→log-line describe routers for the collaborative event log.
   * Same namespaces as {@link eventRouters}; unknown events project to nothing.
   */
  readonly describeEvents?: readonly GameDescribeRouterEntry[];
  /**
   * Optional initial-state seed merged into `SpaceModule.initialState()`.
   * Use when a game's reducers expect certain attributes to be present
   * (e.g. chess puzzle play seeds defaults like `status: 'idle'`).
   */
  readonly initialState?: () => RoomState;
  /**
   * Reset hook applied to room state when the host de-selects this game.
   * Should clear any game-specific attrs so a subsequent select starts fresh.
   * Return the input unchanged when no reset is needed.
   */
  readonly resetRoomState?: (state: RoomState) => RoomState;
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
  readonly id: string;
  /** Display title shown in the games picker (already-localized node). */
  readonly title: ReactNode;
  /** Mounted when this game is the currently selected game in the space. */
  readonly MainMenu: ComponentType<GameClientMenuProps>;
  /**
   * Optional: warm heavy, lazily-loaded assets (WASM, dynamic chunks) before
   * the user selects this game. Fired by the games picker while the list is
   * shown so selecting the game does not block on a first-time load. Must be
   * idempotent and safe to call repeatedly.
   */
  readonly preload?: () => void;
};
