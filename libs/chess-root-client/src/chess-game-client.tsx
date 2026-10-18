import { chessPuzzlesClient } from '@libs/chess-puzzle-client/chess-puzzles-client';
import { PuzzleManagementScreen } from '@libs/chess-puzzle-client/puzzle-management-screen';
import { CHESS_SCREEN } from '@libs/chess-root-shared/chess-screens';
import { ChessSettingsDeveloperScreen } from '@libs/chess-shared-client/chess-settings-developer-screen';
import { ChessSettingsDeveloperUiComponentDetailScreen } from '@libs/chess-shared-client/chess-settings-developer-ui-component-detail-screen';
import { ChessSettingsDeveloperUiComponentsScreen } from '@libs/chess-shared-client/chess-settings-developer-ui-components-screen';
import { ChessSettingsScreen } from '@libs/chess-shared-client/chess-settings-screen';
import { chessGameShared } from '@libs/chess-sub-shared/chess-game';
import { defineGameClient } from '@libs/game-menu-client/game-client';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import { useGameScreen } from '@libs/spaces-client/use-game-screen';
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';
import { chessPresentation } from './chess-game-presentation';

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

/**
 * Chess's client: its board and copy, its puzzles part (board, coach,
 * themes, notation, sounds), its settings and developer tools. The puzzle,
 * puzzle stats, custom-game, opponent and history screens are the
 * platform's.
 */
export const chessGameClient = defineGameClient({
  shared: chessGameShared,
  title: 'Chess',
  caption: 'Puzzles, stats, and custom games',
  subtitle: () => <Trans>Choose how you want to play.</Trans>,
  presentation: chessPresentation,
  puzzles: chessPuzzlesClient,
  settings: {
    caption: () => <Trans>Preferences and developer tools</Trans>,
    Screen: ChessSettingsScreen,
  },
  screens: [
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
});
