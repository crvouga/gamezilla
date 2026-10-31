import { CHESS_SCREEN } from '@libs/chess-root-shared-ts/chess-screens';
import { useCan } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { DefineBackButton } from '@libs/spaces-client-ts/spaces-nav-context';
import { useGameScreen } from '@libs/spaces-client-ts/use-game-screen';
import { Trans } from '@lingui/solid/macro';
import type { MainMenuItem } from '@pkgs/ui-root-client-ts/main-menu-item-row';
import { MainMenuScreen } from '@pkgs/ui-root-client-ts/main-menu-screen';
import type { JSX } from 'solid-js';

export function ChessSettingsDeveloperScreen(): JSX.Element {
  const canManage = useCan(PERMISSION.puzzlesManage);
  const gameScreen = useGameScreen();
  const backToSettings = (): void => {
    gameScreen.show(CHESS_SCREEN.settings);
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
              gameScreen.show(CHESS_SCREEN.settingsDeveloperPuzzles),
          },
        ]
      : []),
  ];

  return (
    <>
      <DefineBackButton onPress={backToSettings} />
      <MainMenuScreen
        screenId="chess-settings-developer"
        title={<Trans>Developer</Trans>}
        subtitle={<Trans>Import and manage puzzle content.</Trans>}
        items={items()}
      />
    </>
  );
}
