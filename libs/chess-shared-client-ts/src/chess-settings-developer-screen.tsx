import { CHESS_SCREEN } from '@libs/chess-root-shared-ts/chess-screens';
import { useCan } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { DefineBackButton } from '@libs/spaces-client-ts/spaces-nav-context';
import { useGameScreen } from '@libs/spaces-client-ts/use-game-screen';
import type { JSX } from 'solid-js';
import { ChessSettingsDeveloperScreenView } from './chess-settings-developer-screen-view';

/** Chess developer tools: wires the view to the puzzle permission and screens. */
export function ChessSettingsDeveloperScreen(): JSX.Element {
  const canManage = useCan(PERMISSION.puzzlesManage);
  const gameScreen = useGameScreen();
  return (
    <>
      <DefineBackButton
        onPress={() => gameScreen.show(CHESS_SCREEN.settings)}
      />
      <ChessSettingsDeveloperScreenView
        canManagePuzzles={canManage()}
        onOpenPuzzles={() =>
          gameScreen.show(CHESS_SCREEN.settingsDeveloperPuzzles)
        }
      />
    </>
  );
}
