import { CHESS_SCREEN } from '@libs/chess-root-shared/chess-screens';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import { useGameScreen } from '@libs/spaces-client/use-game-screen';
import { Trans } from '@lingui/solid/macro';
import type { MainMenuItem } from '@pkgs/ui-root-client/main-menu-item-row';
import { MainMenuScreen } from '@pkgs/ui-root-client/main-menu-screen';
import type { JSX } from 'solid-js';

export function ChessSettingsScreen(): JSX.Element {
  const gameScreen = useGameScreen();
  const backToRoot = (): void => {
    gameScreen.showChoices();
  };
  const openDeveloper = (): void => {
    gameScreen.show(CHESS_SCREEN.settingsDeveloper);
  };

  const items: readonly MainMenuItem[] = [
    {
      key: 'developer',
      dataSet: { testid: 'chess-settings-developer' },
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
