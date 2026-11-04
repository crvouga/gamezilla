import { CHESS_SCREEN } from '@libs/chess-root-shared-ts/chess-screens';
import {
  DefineBackButton,
  useGameChoicesName,
} from '@libs/spaces-client-ts/spaces-nav-context';
import { useGameScreen } from '@libs/spaces-client-ts/use-game-screen';
import type { JSX } from 'solid-js';
import { ChessSettingsScreenView } from './chess-settings-screen-view';

/** Chess settings: wires `ChessSettingsScreenView` to the game's screens. */
export function ChessSettingsScreen(): JSX.Element {
  const gameScreen = useGameScreen();
  const choices = useGameChoicesName();
  return (
    <>
      <DefineBackButton
        onPress={() => gameScreen.showChoices()}
        label={choices()}
      />
      <ChessSettingsScreenView
        onOpenDeveloper={() => gameScreen.show(CHESS_SCREEN.settingsDeveloper)}
      />
    </>
  );
}
