import {
  MainMenuScreen,
  type MainMenuItem,
} from '@gamezilla/client/spaces/games/main-menu-screen';
import {
  CHESS_MAIN_MENU_ROOT,
  CHESS_MAIN_MENU_PUZZLE_PLAY,
  SetChessMainMenuScreen,
} from '@gamezilla/domain/spaces/space-module';
import { Trans } from '@lingui/react/macro';
import { useCallback, type ReactNode } from 'react';

export function PuzzleMainMenu(args: {
  dispatch: (cmd: unknown) => void;
}): ReactNode {
  const { dispatch } = args;

  const backToChessRoot = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_MAIN_MENU_ROOT }));
  }, [dispatch]);
  const openPuzzlePlay = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_MAIN_MENU_PUZZLE_PLAY }));
  }, [dispatch]);

  const items: readonly MainMenuItem[] = [
    {
      key: 'play',
      title: <Trans>Play</Trans>,
      onPress: openPuzzlePlay,
    },
    {
      key: 'profile',
      title: <Trans>Profile</Trans>,
      caption: <Trans>Coming soon</Trans>,
      disabled: true,
    },
  ];

  return (
    <MainMenuScreen
      title={<Trans>Puzzle</Trans>}
      subtitle={<Trans>Pick a puzzle mode.</Trans>}
      items={items}
      onPressBack={backToChessRoot}
    />
  );
}
