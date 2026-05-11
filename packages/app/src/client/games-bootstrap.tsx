import { chessGameClient } from '@gamezilla/chess/client/chess-game-def';
import { GamesRegistryProvider } from '@gamezilla/spaces/client/module/games-registry-context';
import { SpaceModuleProvider } from '@gamezilla/spaces/client/module/space-module-context';
import type { GameClientDefinition } from '@gamezilla/spaces/shared/game';
import { type ReactNode } from 'react';

import { APP_SPACE_MODULE } from '../shared/games';

/**
 * Client-side companion to `APP_GAMES_SHARED`. Each entry here pairs with
 * the same-id entry in `../shared/games.ts` — the shared half drives the
 * authoritative room state, this half drives the games picker UI and each
 * game's `MainMenu` mount. The two lists live in the same package on
 * purpose so a new game can't be added to one without the other.
 */
const APP_GAMES_CLIENT: readonly GameClientDefinition[] = [chessGameClient];

/**
 * Mounts the composed `SpaceModule` and client games registry once for the
 * whole app. Both provider values are module-level singletons (see
 * {@link APP_SPACE_MODULE}), so they are referentially stable across renders
 * and `useSpaceRoomConnection`'s module dep doesn't tear down the WebSocket
 * on every parent re-render — no `useMemo` needed.
 */
export function GamesBootstrap({
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
