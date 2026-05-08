import {
  MainMenuScreen,
  type MainMenuItem,
} from '@gamezilla/client/spaces/games/main-menu-screen';
import {
  useSpaceDispatch,
  useSpaceSelector,
} from '@gamezilla/client/spaces/room/use-space-room-selector';
import {
  CHESS_SCREEN,
  ChessMainMenuScreenAttr,
  SetChessMainMenuScreen,
} from '@gamezilla/domain/spaces/games/chess/chess-main-menu';
import { SelectGame } from '@gamezilla/domain/spaces/games/games';
import { Trans } from '@lingui/react/macro';
import { useCallback, useMemo, type ReactNode } from 'react';
import { PuzzleMainMenu } from './puzzle/puzzle-main-menu';
import { PuzzlePlayScreen } from './puzzle/puzzle-play-screen';

export function ChessMainMenu(): ReactNode {
  const screen = useSpaceSelector(ChessMainMenuScreenAttr.screen.from);

  switch (screen) {
    case CHESS_SCREEN.puzzle:
      return <PuzzleMainMenu />;
    case CHESS_SCREEN.puzzlePlay:
      return <PuzzlePlayScreen />;
    default:
      return <RootMainMenu />;
  }
}

function RootMainMenu(): ReactNode {
  const dispatch = useSpaceDispatch();
  const onBackToGames = useCallback(() => {
    dispatch(SelectGame({ game: null }));
  }, [dispatch]);
  const items = useMemo(
    (): readonly MainMenuItem[] => [
      {
        key: 'puzzle',
        title: <Trans>Puzzle</Trans>,
        onPress: () =>
          dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.puzzle })),
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
    [dispatch]
  );
  return (
    <MainMenuScreen
      title={<Trans>Chess</Trans>}
      subtitle={<Trans>Choose how you want to play.</Trans>}
      items={items}
      onPressBack={onBackToGames}
    />
  );
}
