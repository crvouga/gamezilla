import {
  GAME_CLIENT_DEFINITIONS,
  GAME_DEFINITIONS,
} from '@libs/games/game-plugins.client';
import { GamesBootstrapFromPlugins } from '@libs/spaces/client/module/games-bootstrap-from-plugins';
import type { ReactNode } from 'react';

/** Composed space module and client games registry from `@libs/games`. */
export function AppGamesProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  // #region agent log
  fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': 'b580fa',
    },
    body: JSON.stringify({
      sessionId: 'b580fa',
      location: 'app-games-provider.tsx:render',
      message: 'AppGamesProvider render',
      hypothesisId: 'H10',
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  return (
    <GamesBootstrapFromPlugins
      games={GAME_DEFINITIONS}
      clients={GAME_CLIENT_DEFINITIONS}
    >
      {children}
    </GamesBootstrapFromPlugins>
  );
}
