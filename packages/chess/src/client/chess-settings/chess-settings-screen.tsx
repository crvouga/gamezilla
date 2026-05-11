import { useSpaceRoomDispatch } from '@gamezilla/spaces/client/use-space-room-selector';
import {
  MainMenuScreen,
  type MainMenuItem,
} from '@gamezilla/ui/components/main-menu-screen';
import { Trans } from '@lingui/react/macro';
import { useCallback, useMemo, type ReactNode } from 'react';
import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
} from '../../shared/chess-main-menu';

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
    <MainMenuScreen
      title={<Trans>Settings</Trans>}
      subtitle={<Trans>Chess preferences and developer tools.</Trans>}
      items={items}
      onPressBack={backToRoot}
    />
  );
}
