import {
  MainMenuScreen,
  type MainMenuItem,
} from '@gamezilla/spaces/client/main-menu-screen';
import { useSpaceDispatch } from '@gamezilla/spaces/client/use-space-room-selector';
import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
} from '../shared/chess-main-menu';
import { Trans } from '@lingui/react/macro';
import { useCallback, type ReactNode } from 'react';

export function PuzzleMainMenu(): ReactNode {
  const dispatch = useSpaceDispatch();
  const backToChessRoot = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.root }));
  }, [dispatch]);
  const openPuzzlePicker = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.puzzlePicker }));
  }, [dispatch]);

  const items: readonly MainMenuItem[] = [
    {
      key: 'play',
      title: <Trans>Play</Trans>,
      onPress: openPuzzlePicker,
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
