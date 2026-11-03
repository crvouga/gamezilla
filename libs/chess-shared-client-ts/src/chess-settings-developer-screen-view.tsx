import { Trans } from '@lingui/solid/macro';
import type { MainMenuItem } from '@pkgs/ui-root-client-ts/main-menu-item-row';
import { MainMenuScreen } from '@pkgs/ui-root-client-ts/main-menu-screen';
import type { JSX } from 'solid-js';

export type ChessSettingsDeveloperScreenViewProps = {
  /** Whether the person may manage puzzles; only then is loading offered. */
  readonly canManagePuzzles: boolean;
  readonly onOpenPuzzles: () => void;
};

/**
 * Chess developer tools, presentational: loading puzzle content, offered
 * to a person allowed to manage puzzles. `ChessSettingsDeveloperScreen`
 * reads that permission and wires the screens.
 */
export function ChessSettingsDeveloperScreenView(
  props: ChessSettingsDeveloperScreenViewProps
): JSX.Element {
  const items = (): readonly MainMenuItem[] =>
    props.canManagePuzzles
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
            onClick: () => props.onOpenPuzzles(),
          },
        ]
      : [];
  return (
    <MainMenuScreen
      screenId="chess-settings-developer"
      title={<Trans>Developer</Trans>}
      subtitle={<Trans>Import and manage puzzle content.</Trans>}
      items={items()}
    />
  );
}
