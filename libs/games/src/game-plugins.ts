import type { GamePluginShared } from '@libs/spaces/shared/game-plugin';

/**
 * Authoritative list of games composed into the app. Server (`apps/api`) and
 * client (`apps/client`) both derive from this registry so the set of playable
 * games can never drift between sides.
 *
 * Client UI loaders live in `game-plugins.client.ts` so Wrangler never bundles
 * React Native / Expo assets when building the API worker.
 *
 * Each entry uses dynamic `import()` so the game's shared code is split into
 * its own chunk and only fetched when {@link loadGameDefinitions} runs.
 *
 * Adding a new game = drop one entry here and add a matching client loader in
 * `game-plugins.client.ts`, plus a workspace dep on its lib.
 */
export const GAME_PLUGINS = [
  {
    id: 'chess',
    loadShared: () =>
      import('@libs/chess/shared/chess-game').then((m) => m.chessGameShared),
  },
] as const satisfies readonly GamePluginShared[];
