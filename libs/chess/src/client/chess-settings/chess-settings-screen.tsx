import { DefineBackButton } from '@libs/spaces/client/nav/spaces-nav-context';
import { useSpaceRoomDispatch } from '@libs/spaces/client/room/use-space-room-selector';
import { Trans } from '@lingui/react/macro';
import {
  type MainMenuItem,
  MainMenuScreen,
} from '@pkgs/ui/components/main-menu-screen';
import { type ReactNode, useCallback, useMemo } from 'react';
import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
} from '../../shared/chess-main-menu';

export function ChessSettingsScreen(): ReactNode {
  const dispatch = useSpaceRoomDispatch();
  const backToRoot = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.root }));
  }, [dispatch]);
  const openPuzzleFeed = useCallback(() => {
    dispatch(
      SetChessMainMenuScreen({ screen: CHESS_SCREEN.settingsPuzzleFeed })
    );
  }, [dispatch]);
  const openDeveloper = useCallback(() => {
    dispatch(
      SetChessMainMenuScreen({ screen: CHESS_SCREEN.settingsDeveloper })
    );
  }, [dispatch]);

  const items = useMemo(
    (): readonly MainMenuItem[] => [
      {
        key: 'puzzle-feed',
        title: <Trans>Puzzle feed</Trans>,
        caption: <Trans>Auto match rating or pick a custom target.</Trans>,
        onPress: openPuzzleFeed,
      },
      {
        key: 'developer',
        title: <Trans>Developer</Trans>,
        caption: <Trans>UI explorer, debug tools.</Trans>,
        onPress: openDeveloper,
      },
    ],
    [openDeveloper, openPuzzleFeed]
  );

  return (
    <>
      <DefineBackButton onPress={backToRoot} />
      <MainMenuScreen
        screenId="chess-settings"
        title={<Trans>Settings</Trans>}
        subtitle={<Trans>Chess preferences and developer tools.</Trans>}
        items={items}
      />
    </>
  );
}
