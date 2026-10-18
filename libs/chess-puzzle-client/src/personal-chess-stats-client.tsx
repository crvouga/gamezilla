import { CHESS_GAME_ID } from '@libs/chess-puzzle-shared/chess-game';
import { PersonalPuzzleStatsScreen } from '@libs/game-puzzle-client/personal-puzzle-stats-screen';
import { defineSubClient } from '@libs/sub-client/client';
import { Trans } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import type { JSX } from 'solid-js';
import { chessPuzzlesClient } from './chess-puzzles-client';

function PersonalChessStatsSettings(): JSX.Element {
  const router = useRouter();
  return (
    <MenuSection title={<Trans>Chess</Trans>}>
      <MenuRow
        title={<Trans>Puzzle stats</Trans>}
        caption={<Trans>Your rating and game log, available offline</Trans>}
        onClick={() => router.push('/more/chess-stats')}
        dataSet={{ testid: 'settings-chess-stats' }}
      />
    </MenuSection>
  );
}

/** Chess's puzzle rating, game log and reviews, outside any space. */
function PersonalChessStatsScreen(): JSX.Element {
  return (
    <PersonalPuzzleStatsScreen
      gameId={CHESS_GAME_ID}
      puzzles={chessPuzzlesClient}
      screenId="personal-chess-stats"
    />
  );
}

export const PERSONAL_CHESS_STATS_CLIENT = defineSubClient({
  name: 'personal-chess-stats',
  routes: [{ path: '/more/chess-stats', component: PersonalChessStatsScreen }],
  settings: PersonalChessStatsSettings,
});
