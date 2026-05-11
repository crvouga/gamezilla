import { createContext, useContext, type ReactNode } from 'react';

import type { GameClientDefinition } from '@gamezilla/spaces/shared/game';

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
 * once at the composition root (`packages/client/src/app/_layout.tsx`) — the
 * spaces UI then reads the registry without `@gamezilla/spaces` knowing
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
