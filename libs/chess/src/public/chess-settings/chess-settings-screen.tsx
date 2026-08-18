import { DefineBackButton } from '@libs/spaces/public/nav/spaces-nav-context';
import { useSpaceRoomDispatch } from '@libs/spaces/public/room/use-space-room-selector';
import { Trans } from '@lingui/react/macro';
import {
  type MainMenuItem,
  MainMenuScreen,
} from '@pkgs/ui/components/main-menu-screen';
import { type ReactNode, useCallback, useMemo } from 'react';
import { CHESS_SCREEN, SetChessMainMenuScreen } from '../chess-main-menu';

export function ChessSettingsScreen(): ReactNode {
  const dispatch = useSpaceRoomDispatch();
  const backToRoot = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.root }));
  }, [dispatch]);
  const openDeveloper = useCallback(() => {
    dispatch(
      SetChessMainMenuScreen({ screen: CHESS_SCREEN.settingsDeveloper })
    );
  }, [dispatch]);

  const items = useMemo(
    (): readonly MainMenuItem[] => [
      {
        key: 'developer',
        title: <Trans>Developer</Trans>,
        caption: <Trans>UI explorer, debug tools.</Trans>,
        onPress: openDeveloper,
      },
    ],
    [openDeveloper]
  );

  return (
    <>
      <DefineBackButton onPress={backToRoot} />
      <MainMenuScreen
        screenId="chess-settings"
        title={<Trans>Settings</Trans>}
        subtitle={<Trans>Developer tools.</Trans>}
        items={items}
      />
    </>
  );
}
