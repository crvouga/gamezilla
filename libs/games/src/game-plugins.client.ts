import type { GamePlugin } from '@libs/spaces/shared/game-plugin';

import { GAME_PLUGINS as GAME_PLUGINS_SHARED } from './game-plugins';

const CLIENT_LOADERS: Record<
  (typeof GAME_PLUGINS_SHARED)[number]['id'],
  GamePlugin['loadClient']
> = {
  chess: () =>
    import('@libs/chess/client/chess-game-def').then((m) => m.chessGameClient),
};

/**
 * Full plugin registry for the client — shared loaders from {@link GAME_PLUGINS}
 * plus lazy client definitions. Not imported by `apps/api`.
 */
export const GAME_PLUGINS: readonly GamePlugin[] = GAME_PLUGINS_SHARED.map(
  (plugin) => ({
    id: plugin.id,
    loadShared: plugin.loadShared,
    loadClient: CLIENT_LOADERS[plugin.id],
  })
);
