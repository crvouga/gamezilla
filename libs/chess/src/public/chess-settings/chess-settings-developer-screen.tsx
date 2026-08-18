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

export function ChessSettingsDeveloperScreen(): ReactNode {
  const dispatch = useSpaceRoomDispatch();
  const backToSettings = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.settings }));
  }, [dispatch]);
  const openUiComponents = useCallback(() => {
    dispatch(
      SetChessMainMenuScreen({ screen: CHESS_SCREEN.settingsDeveloperUi })
    );
  }, [dispatch]);

  const items = useMemo(
    (): readonly MainMenuItem[] => [
      {
        key: 'ui-components',
        title: <Trans>UI Components</Trans>,
        caption: <Trans>Browse design system primitives in this space.</Trans>,
        onPress: openUiComponents,
      },
    ],
    [openUiComponents]
  );

  return (
    <>
      <DefineBackButton onPress={backToSettings} />
      <MainMenuScreen
        screenId="chess-settings-developer"
        title={<Trans>Developer</Trans>}
        subtitle={<Trans>Tools for debugging and exploring the UI.</Trans>}
        items={items}
      />
    </>
  );
}
