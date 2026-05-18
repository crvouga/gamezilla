import {
  MainMenuScreen,
  type MainMenuItem,
} from '@gamezilla/ui/components/main-menu-screen';
import { DefineBackButton } from '@gamezilla/spaces/client/nav/spaces-nav-context';
import { useSpaceRoomDispatch } from '@gamezilla/spaces/client/room/use-space-room-selector';
import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
} from '../../shared/chess-main-menu';
import { Trans } from '@lingui/react/macro';
import { useCallback, useMemo, type ReactNode } from 'react';

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
        title={<Trans>Developer</Trans>}
        subtitle={<Trans>Tools for debugging and exploring the UI.</Trans>}
        items={items}
      />
    </>
  );
}
