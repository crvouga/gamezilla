import { multiplayerLinkRoute } from '@libs/game-matchmaking-shared/multiplayer-link';
import { defineSubClient } from '@libs/sub-client/client';
import type { TurnGames } from '@pkgs/turn-game-shared/game-rules';
import { MultiplayerLinkScreen } from './multiplayer-link-screen';
/** Routing is registered from capabilities supplied by the composition root. */
export function createMultiplayerLinkClient(rules: TurnGames) {
  return defineSubClient({
    name: 'multiplayer-link',
    routes: rules.games.map((game) => ({
      path: multiplayerLinkRoute(game.rules.id),
      component: () => <MultiplayerLinkScreen gameId={game.rules.id} />,
    })),
  });
}
