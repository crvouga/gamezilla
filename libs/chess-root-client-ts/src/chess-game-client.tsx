import { chessPuzzlesClient } from '@libs/chess-puzzle-client-ts/chess-puzzles-client';
import { PuzzleManagementScreen } from '@libs/chess-puzzle-client-ts/puzzle-management-screen';
import { CHESS_SCREEN } from '@libs/chess-root-shared-ts/chess-screens';
import { ChessSettingsDeveloperScreen } from '@libs/chess-shared-client-ts/chess-settings-developer-screen';
import { ChessSettingsScreen } from '@libs/chess-shared-client-ts/chess-settings-screen';
import { chessGameShared } from '@libs/chess-sub-shared-ts/chess-game';
import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import { DefineBackButton } from '@libs/spaces-client-ts/spaces-nav-context';
import { useGameScreen } from '@libs/spaces-client-ts/use-game-screen';
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
  ],
});
