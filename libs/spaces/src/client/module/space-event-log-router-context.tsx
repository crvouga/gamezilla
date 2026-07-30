/**
 * Provides the composed space event-log describe router (including game
 * describeEvents) so chrome and attribution stay game-agnostic.
 */

import type { EventLogRouter } from '@pkgs/collab';
import { createContext, useContext, type ReactNode } from 'react';

const SpaceEventLogRouterContext = createContext<EventLogRouter | null>(null);

export type SpaceEventLogRouterProviderProps = {
  readonly value: EventLogRouter;
  readonly children: ReactNode;
};

export function SpaceEventLogRouterProvider({
  value,
  children,
}: SpaceEventLogRouterProviderProps): ReactNode {
  return (
    <SpaceEventLogRouterContext.Provider value={value}>
      {children}
    </SpaceEventLogRouterContext.Provider>
  );
}

/**
 * Read the composed event-log router. Crashes if no provider is mounted —
 * {@link GamesBootstrapFromPlugins} must wrap the tree.
 */
export function useSpaceEventLogRouter(): EventLogRouter {
  const router = useContext(SpaceEventLogRouterContext);
  if (router === null) {
    throw new Error(
      'useSpaceEventLogRouter: no <SpaceEventLogRouterProvider> in tree'
    );
  }
  return router;
}
