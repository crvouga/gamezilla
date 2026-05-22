import { useMemo, type ReactNode } from 'react';

import type { GameClientDefinition, GameDefinition } from '../../shared/game';
import { composeSpaceRoomModule } from '../../shared/load-game-plugins';
import { GamesRegistryProvider } from './games-registry-context';
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
  const module = useMemo(
    (): SpaceRoomModule => composeSpaceRoomModule(games),
    [games]
  );

  return (
    <SpaceModuleProvider value={module}>
      <GamesRegistryProvider value={clients}>
        {children}
      </GamesRegistryProvider>
    </SpaceModuleProvider>
  );
}
