import type { GameClientDefinition } from '@libs/spaces-shared/game';
import {
  type Accessor,
  createContext,
  type JSX,
  type ParentProps,
  untrack,
  useContext,
} from 'solid-js';

const GamesRegistryContext = createContext<
  Accessor<readonly GameClientDefinition[]>
>(() => []);

export type GamesRegistryProviderProps = {
  /** Game client definitions, registered at the composition root. */
  readonly value: readonly GameClientDefinition[];
  readonly children: JSX.Element;
};

/**
 * Provides the set of games available inside a space. Wrap the app shell
 * once at the composition root (`apps/client/src/app.tsx`) — the
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
export function useGamesRegistry(): readonly GameClientDefinition[] {
  return useContext(GamesRegistryContext)();
}
