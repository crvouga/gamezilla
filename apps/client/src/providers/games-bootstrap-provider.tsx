import { chessGameClient } from '@libs/chess/client/chess-game-def';
import { APP_SPACE_MODULE } from '@libs/app/shared/games';
import { GamesRegistryProvider } from '@libs/spaces/client/module/games-registry-context';
import { SpaceModuleProvider } from '@libs/spaces/client/module/space-module-context';
import type { GameClientDefinition } from '@libs/spaces/shared/game';
import type { ReactNode } from 'react';

/**
 * Client-side companion to `APP_GAMES_SHARED` in `@libs/app/shared/games`.
 * Each entry pairs with the same-id shared definition — shared drives
 * authoritative room state; this drives the games picker UI and each game's
 * `MainMenu` mount.
 */
const APP_GAMES_CLIENT: readonly GameClientDefinition[] = [chessGameClient];

/**
 * Mounts the composed `SpaceModule` and client games registry once for the
 * whole app. Both provider values are module-level singletons (see
 * {@link APP_SPACE_MODULE}), so they are referentially stable across renders
 * and `useSpaceRoomConnection`'s module dep doesn't tear down the WebSocket
 * on every parent re-render — no `useMemo` needed.
 */
export function GamesBootstrapProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <SpaceModuleProvider value={APP_SPACE_MODULE}>
      <GamesRegistryProvider value={APP_GAMES_CLIENT}>
        {children}
      </GamesRegistryProvider>
    </SpaceModuleProvider>
  );
}
