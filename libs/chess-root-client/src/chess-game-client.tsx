import { ChessPuzzleFeedProvider } from '@libs/chess-puzzle-client/chess-puzzle-feed-provider';
import { PuzzlePlayScreen } from '@libs/chess-puzzle-client/chess-puzzle-play-screen';
import { ChessPuzzleReviewScreen } from '@libs/chess-puzzle-client/chess-puzzle-review-screen';
import { ChessStatsScreen } from '@libs/chess-puzzle-client/chess-stats-screen';
import { PuzzleManagementScreen } from '@libs/chess-puzzle-client/puzzle-management-screen';
import { ReconcilePuzzleResult } from '@libs/chess-puzzle-client/reconcile-puzzle-result';
import { useIsPuzzleDriver } from '@libs/chess-puzzle-client/use-puzzle-space-role';
import { CHESS_GAME_ID } from '@libs/chess-puzzle-shared/chess-game';
import { CHESS_SCREEN } from '@libs/chess-root-shared/chess-screens';
import { ChessSettingsDeveloperScreen } from '@libs/chess-shared-client/chess-settings-developer-screen';
import { ChessSettingsDeveloperUiComponentDetailScreen } from '@libs/chess-shared-client/chess-settings-developer-ui-component-detail-screen';
import { ChessSettingsDeveloperUiComponentsScreen } from '@libs/chess-shared-client/chess-settings-developer-ui-components-screen';
import { ChessSettingsScreen } from '@libs/chess-shared-client/chess-settings-screen';
import { defineGameClient } from '@libs/game-menu-client/game-client';
import { LINKED_PUZZLE_PARAM } from '@libs/game-puzzle-shared/puzzle-link';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import { useGameScreen } from '@libs/spaces-client/use-game-screen';
import { Trans } from '@lingui/solid/macro';
import { useLocalSearchParams } from '@pkgs/ui-root-client/app-router';
import type { JSX } from 'solid-js';
import { createEffect, untrack } from 'solid-js';
import { chessPresentation } from './chess-game-presentation';

/** A space opened from a puzzle link goes straight to the puzzle. */
function LinkedPuzzle(): JSX.Element {
  const params = useLocalSearchParams<{ puzzle?: string | undefined }>();
  const isDriver = useIsPuzzleDriver();
  const gameScreen = useGameScreen();
  createEffect(() => {
    if (params()[LINKED_PUZZLE_PARAM] === undefined || !isDriver()) return;
    if (gameScreen.screen() === CHESS_SCREEN.puzzle) return;
    untrack(() => gameScreen.show(CHESS_SCREEN.puzzle));
  });
  return null;
}

/** Every chess screen reads the puzzle feed and honours a puzzle link. */
function ChessFrame(props: { children: JSX.Element }): JSX.Element {
  return (
    <ChessPuzzleFeedProvider>
      <LinkedPuzzle />
      {props.children}
    </ChessPuzzleFeedProvider>
  );
}

function DeveloperPuzzlesScreen(): JSX.Element {
  const gameScreen = useGameScreen();
  return (
    <>
      <DefineBackButton
        onPress={() => gameScreen.show(CHESS_SCREEN.settingsDeveloper)}
      />
      <PuzzleManagementScreen embedded />
    </>
  );
}

export const chessGameClient = defineGameClient({
  id: CHESS_GAME_ID,
  title: 'Chess',
  caption: 'Puzzles, stats, and custom games',
  subtitle: () => <Trans>Choose how you want to play.</Trans>,
  presentation: chessPresentation,
  choices: [
    {
      screen: CHESS_SCREEN.puzzle,
      title: () => <Trans>Puzzle</Trans>,
      caption: () => <Trans>Solve rated puzzles and climb the ladder</Trans>,
      Screen: PuzzlePlayScreen,
    },
    {
      screen: CHESS_SCREEN.stats,
      title: () => <Trans>Puzzle stats</Trans>,
      caption: () => <Trans>Puzzle rating trend and game log</Trans>,
      Screen: ChessStatsScreen,
    },
  ],
  settings: {
    caption: () => <Trans>Preferences and developer tools</Trans>,
    Screen: ChessSettingsScreen,
  },
  screens: [
    { screen: CHESS_SCREEN.statsReview, Screen: ChessPuzzleReviewScreen },
    {
      screen: CHESS_SCREEN.settingsDeveloper,
      Screen: ChessSettingsDeveloperScreen,
    },
    {
      screen: CHESS_SCREEN.settingsDeveloperPuzzles,
      Screen: DeveloperPuzzlesScreen,
    },
    {
      screen: CHESS_SCREEN.settingsDeveloperUi,
      Screen: ChessSettingsDeveloperUiComponentsScreen,
    },
    {
      screen: CHESS_SCREEN.settingsDeveloperUiDetail,
      Screen: ChessSettingsDeveloperUiComponentDetailScreen,
    },
  ],
  Frame: ChessFrame,
  SessionEffects: ReconcilePuzzleResult,
});
