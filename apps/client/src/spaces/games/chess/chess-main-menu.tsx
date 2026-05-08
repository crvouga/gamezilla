import {
  MainMenuScreen,
  type MainMenuItem,
} from '@gamezilla/client/spaces/games/main-menu-screen';
import {
  useSpaceDispatch,
  useSpaceSelector,
} from '@gamezilla/client/spaces/room/use-space-room-selector';
import {
  CHESS_MAIN_MENU_PUZZLE,
  CHESS_MAIN_MENU_PUZZLE_PLAY,
  ChessMainMenuScreenAttr,
  SelectGame,
  SetChessMainMenuScreen,
} from '@gamezilla/domain/spaces/space-module';
import { Trans } from '@lingui/react/macro';
import { useCallback, useMemo, type ReactNode } from 'react';
import { PuzzleMainMenu } from './puzzle/puzzle-main-menu';
import { PuzzlePlayScreen } from './puzzle/puzzle-play-screen';

function useRootItems(openPuzzleMenu: () => void): readonly MainMenuItem[] {
  return useMemo(
    (): readonly MainMenuItem[] => [
      {
        key: 'puzzle',
        title: <Trans>Puzzle</Trans>,
        onPress: openPuzzleMenu,
      },
      {
        key: 'custom-games',
        title: <Trans>Custom Games</Trans>,
        caption: <Trans>Coming soon</Trans>,
        disabled: true,
      },
      {
        key: 'matchmaking',
        title: <Trans>Matchmaking</Trans>,
        caption: <Trans>Coming soon</Trans>,
        disabled: true,
      },
    ],
    [openPuzzleMenu]
  );
}

export function ChessMainMenu(): ReactNode {
  const screen = useSpaceSelector(ChessMainMenuScreenAttr.screen.from);
  const dispatch = useSpaceDispatch();
  const onBackToGames = useCallback(() => {
    dispatch(SelectGame({ game: null }));
  }, [dispatch]);
  const openPuzzleMenu = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_MAIN_MENU_PUZZLE }));
  }, [dispatch]);
  const rootItems = useRootItems(openPuzzleMenu);

  if (screen === CHESS_MAIN_MENU_PUZZLE) {
    return <PuzzleMainMenu dispatch={dispatch} />;
  }
  if (screen === CHESS_MAIN_MENU_PUZZLE_PLAY) {
    return <PuzzlePlayScreen dispatch={dispatch} />;
  }

  return (
    <MainMenuScreen
      title={<Trans>Chess</Trans>}
      subtitle={<Trans>Choose how you want to play.</Trans>}
      items={rootItems}
      onPressBack={onBackToGames}
    />
  );
}
