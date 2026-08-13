import type { GameClientDefinition } from '@libs/spaces/shared/game';
import { createContext, type ReactNode, useContext } from 'react';

const GamesRegistryContext = createContext<
  readonly GameClientDefinition[] | null
>(null);

export type GamesRegistryProviderProps = {
  /** Game client definitions, registered at the composition root. */
  readonly value: readonly GameClientDefinition[];
  readonly children: ReactNode;
};

/**
 * Provides the set of games available inside a space. Wrap the app shell
 * once at the composition root (`apps/client/src/app.tsx`) — the
 * spaces UI then reads the registry without `@libs/spaces` knowing
 * anything about specific games.
 */
export function GamesRegistryProvider({
  value,
  children,
}: GamesRegistryProviderProps): ReactNode {
  return (
    <GamesRegistryContext.Provider value={value}>
      {children}
    </GamesRegistryContext.Provider>
  );
}

/**
 * Read the registered games. Returns an empty list when no provider is
 * mounted (e.g. tests that don't exercise the game list).
 */
export function useGamesRegistry(): readonly GameClientDefinition[] {
  return useContext(GamesRegistryContext) ?? [];
}
