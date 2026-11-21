import type { GameClientDefinition } from '@libs/spaces-shared-ts/game';
import type { GameTileMotif } from '@pkgs/ui-root-client-ts/game-tile';
import {
  type Accessor,
  createContext,
  type JSX,
  type ParentProps,
  untrack,
  useContext,
} from 'solid-js';

/** A registered game as the space offers it: its definition and tile art. */
export type SpaceGameClient = GameClientDefinition & {
  /** The game's name, as words (a mode's row among its family's). */
  readonly title: string;
  /** The game's picture on its tile (`GameTile`). */
  readonly motif: GameTileMotif;
};

const GamesRegistryContext = createContext<
  Accessor<readonly SpaceGameClient[]>
>(() => []);

export type GamesRegistryProviderProps = {
  /** Game client definitions, registered at the composition root. */
  readonly value: readonly SpaceGameClient[];
  readonly children: JSX.Element;
};

/**
 * Provides the set of games available inside a space. Wrap the app shell
 * once at the composition root (`apps/client-ts/src/app.tsx`) — the
 * spaces UI then reads the registry without `@libs/spaces` knowing
 * anything about specific games.
 */
export function GamesRegistryProvider(
  props: ParentProps<GamesRegistryProviderProps>
): JSX.Element {
  // Registry is composition-root configuration: read once, not tracked.
  const value = untrack(() => props.value);
  return (
    <GamesRegistryContext.Provider value={() => value}>
      {props.children}
    </GamesRegistryContext.Provider>
  );
}

/**
 * Read the registered games. Returns an empty list when no provider is
 * mounted (e.g. tests that don't exercise the game list).
 */
export function useGamesRegistry(): readonly SpaceGameClient[] {
  return useContext(GamesRegistryContext)();
}
