import { DefineBackButton } from '@libs/spaces/public/nav/spaces-nav-context';
import { useSpaceRoomDispatch } from '@libs/spaces/public/room/use-space-room-selector';
import { Trans } from '@lingui/solid/macro';
import { type MainMenuItem, MainMenuScreen } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import { CHESS_SCREEN, SetChessMainMenuScreen } from '../chess-main-menu';

export function ChessSettingsScreen(): JSX.Element {
  const dispatch = useSpaceRoomDispatch();
  const backToRoot = (): void => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.root }));
  };
  const openDeveloper = (): void => {
    dispatch(
      SetChessMainMenuScreen({ screen: CHESS_SCREEN.settingsDeveloper })
    );
  };

  const items: readonly MainMenuItem[] = [
    {
      key: 'developer',
      title: <Trans>Developer</Trans>,
      caption: <Trans>UI explorer, debug tools.</Trans>,
      onClick: openDeveloper,
    },
  ];

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
