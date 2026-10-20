import { PersonalPuzzleStatsScreen } from '@libs/game-puzzle-client/personal-puzzle-stats-screen';
import type { GamePuzzlesClient } from '@libs/game-puzzle-client/puzzle-client';
import { defineSubClient, type SubClient } from '@libs/sub-client/client';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import type { GameClientRegistration } from './game-client';

/** The same account-owned stats and review surface for every puzzle game. */
function statsClient(
  game: GameClientRegistration,
  puzzles: GamePuzzlesClient
): SubClient {
  const path = `/more/${game.id}-stats`;
  const screenId = `personal-${game.id}-stats`;
  return defineSubClient({
    name: screenId,
    routes: [
      {
        path,
        component: () => (
          <PersonalPuzzleStatsScreen
            gameId={game.id}
            puzzles={puzzles}
            screenId={screenId}
          />
        ),
      },
    ],
    settings: () => {
      const router = useRouter();
      return (
        <MenuSection title={game.title}>
          <MenuRow
            title={<Trans>Puzzle stats</Trans>}
            caption={<Trans>Your rating and game log, available offline</Trans>}
            onClick={() => router.push(path)}
            dataSet={{ testid: Handles.settingsPuzzleStats(game.id) }}
          />
        </MenuSection>
      );
    },
  });
}

/** Composition supplies the complete client list; no game registers another stats screen. */
export function createPersonalPuzzleStatsClients(
  games: readonly GameClientRegistration[]
): readonly SubClient[] {
  return games.flatMap((game) =>
    game.puzzles === undefined ? [] : [statsClient(game, game.puzzles)]
  );
}
