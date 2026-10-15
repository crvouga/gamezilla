import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
} from '@libs/chess-root-shared/chess-main-menu';
import { useCan } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import { useSpaceRoomDispatch } from '@libs/spaces-client/use-space-room-selector';
import { Trans } from '@lingui/solid/macro';
import type { MainMenuItem } from '@pkgs/ui-root-client/main-menu-item-row';
import { MainMenuScreen } from '@pkgs/ui-root-client/main-menu-screen';
import type { JSX } from 'solid-js';

export function ChessSettingsDeveloperScreen(): JSX.Element {
  const canManage = useCan(PERMISSION.puzzlesManage);
  const dispatch = useSpaceRoomDispatch();
  const backToSettings = (): void => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.settings }));
  };
  const openUiComponents = (): void => {
    dispatch(
      SetChessMainMenuScreen({ screen: CHESS_SCREEN.settingsDeveloperUi })
    );
  };

  const items = (): readonly MainMenuItem[] => [
    ...(canManage()
      ? [
          {
            key: 'puzzles',
            title: <Trans>Load chess puzzles</Trans>,
            caption: (
              <Trans>
                Load Lichess CSV, follow progress, and stop loading.
              </Trans>
            ),
            dataSet: { testid: 'chess-developer-puzzles' },
            onClick: () =>
              dispatch(
                SetChessMainMenuScreen({
                  screen: CHESS_SCREEN.settingsDeveloperPuzzles,
                })
              ),
          },
        ]
      : []),
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
        items={items()}
      />
    </>
  );
}
