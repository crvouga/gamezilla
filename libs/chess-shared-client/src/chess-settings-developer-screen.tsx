import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
} from '@libs/chess-shared/chess-main-menu';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import { useSpaceRoomDispatch } from '@libs/spaces-client/use-space-room-selector';
import { Trans } from '@lingui/solid/macro';
import type { MainMenuItem } from '@pkgs/ui-client/main-menu-item-row';
import { MainMenuScreen } from '@pkgs/ui-client/main-menu-screen';
import type { JSX } from 'solid-js';

export function ChessSettingsDeveloperScreen(): JSX.Element {
  const dispatch = useSpaceRoomDispatch();
  const backToSettings = (): void => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.settings }));
  };
  const openUiComponents = (): void => {
    dispatch(
      SetChessMainMenuScreen({ screen: CHESS_SCREEN.settingsDeveloperUi })
    );
  };

  const items: readonly MainMenuItem[] = [
    {
      key: 'ui-components',
      title: <Trans>UI Components</Trans>,
      caption: <Trans>Browse design system primitives in this space.</Trans>,
      onClick: openUiComponents,
    },
  ];

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
