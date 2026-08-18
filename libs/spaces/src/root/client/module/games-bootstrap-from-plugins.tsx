import { useClock } from '@pkgs/clock';
import { type ReactNode, useMemo } from 'react';

import type { GameClientDefinition, GameDefinition } from '../../shared/game';
import { composeSpaceRoomModule } from '../../shared/load-game-plugins';
import { createSpaceEventLogRouter } from '../../shared/space-log/space-log-router';
import { GamesRegistryProvider } from './games-registry-context';
import { SpaceEventLogRouterProvider } from './space-event-log-router-context';
import {
  SpaceModuleProvider,
  type SpaceRoomModule,
} from './space-module-context';

export type GamesBootstrapFromPluginsProps = {
  readonly games: readonly GameDefinition[];
  readonly clients: readonly GameClientDefinition[];
  readonly children: ReactNode;
};

/**
 * Composition-root component that provides the composed `SpaceModule` and
 * client games registry from an eager {@link GAME_DEFINITIONS} registry.
 */
export function GamesBootstrapFromPlugins({
  games,
  clients,
  children,
}: GamesBootstrapFromPluginsProps): ReactNode {
  const clock = useClock();
  const module = useMemo(
    (): SpaceRoomModule => composeSpaceRoomModule(games, clock.now),
    [clock, games]
  );
  const eventLogRouter = useMemo(
    () => createSpaceEventLogRouter(games),
    [games]
  );

  return (
    <SpaceModuleProvider value={module}>
      <SpaceEventLogRouterProvider value={eventLogRouter}>
        <GamesRegistryProvider value={clients}>
          {children}
        </GamesRegistryProvider>
      </SpaceEventLogRouterProvider>
    </SpaceModuleProvider>
  );
}
