import { Trans } from '@lingui/solid/macro';
import type { MainMenuItem } from '@pkgs/ui-root-client-ts/main-menu-item-row';
import { MainMenuScreen } from '@pkgs/ui-root-client-ts/main-menu-screen';
import type { JSX } from 'solid-js';

export type ChessSettingsScreenViewProps = {
  readonly onOpenDeveloper: () => void;
};

/**
 * Chess settings, presentational: the menu of chess preferences, which
 * today holds the developer tools. `ChessSettingsScreen` wires the menu to
 * the game's screens and its back button.
 */
export function ChessSettingsScreenView(
  props: ChessSettingsScreenViewProps
): JSX.Element {
  const items = (): readonly MainMenuItem[] => [
    {
      key: 'developer',
      dataSet: { testid: 'chess-settings-developer' },
      title: <Trans>Developer</Trans>,
      caption: <Trans>Puzzle import tools.</Trans>,
      onClick: () => props.onOpenDeveloper(),
    },
  ];
  return (
    <MainMenuScreen
      screenId="chess-settings"
      title={<Trans>Settings</Trans>}
      subtitle={<Trans>Developer tools.</Trans>}
      items={items()}
    />
  );
}
