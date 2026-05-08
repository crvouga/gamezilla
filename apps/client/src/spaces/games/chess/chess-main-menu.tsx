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
  CHESS_MAIN_MENU_ROOT,
  ChessMainMenuScreenAttr,
  SelectGame,
  SetChessMainMenuScreen,
} from '@gamezilla/domain/spaces/space-module';
import { Trans } from '@lingui/react/macro';
import { useCallback, useMemo, type ReactNode } from 'react';

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

const PUZZLE_ITEMS: readonly MainMenuItem[] = [
  {
    key: 'daily-puzzle',
    title: <Trans>Daily Puzzle</Trans>,
    caption: <Trans>Coming soon</Trans>,
    disabled: true,
  },
  {
    key: 'practice-puzzles',
    title: <Trans>Practice Puzzles</Trans>,
    caption: <Trans>Coming soon</Trans>,
    disabled: true,
  },
];

export function ChessMainMenu(): ReactNode {
  const screen = useSpaceSelector(ChessMainMenuScreenAttr.screen.from);
  const dispatch = useSpaceDispatch();
  const onBackToGames = useCallback(() => {
    dispatch(SelectGame({ game: null }));
  }, [dispatch]);
  const openPuzzleMenu = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_MAIN_MENU_PUZZLE }));
  }, [dispatch]);
  const backToChessRoot = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_MAIN_MENU_ROOT }));
  }, [dispatch]);
  const rootItems = useRootItems(openPuzzleMenu);

  if (screen === CHESS_MAIN_MENU_PUZZLE) {
    return (
      <MainMenuScreen
        title={<Trans>Puzzle</Trans>}
        subtitle={<Trans>Pick a puzzle mode.</Trans>}
        items={PUZZLE_ITEMS}
        onPressBack={backToChessRoot}
      />
    );
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
