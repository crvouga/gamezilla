import { chessCatalogueLoad } from '@libs/chess-puzzle-client-ts/chess-catalogue-load';
import type { GameSettings } from '@libs/game-menu-client-ts/game-settings';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';

/**
 * Chess's settings, as data the platform draws: the puzzle loader, for a
 * person allowed to manage puzzles. Nobody else is offered Settings.
 */
export const chessSettings: GameSettings = {
  caption: () => <Trans>Load puzzles, for puzzle managers</Trans>,
  subtitle: () => <Trans>Tools for the people who manage chess puzzles.</Trans>,
  rows: [
    {
      key: 'puzzles',
      title: () => t`Load chess puzzles`,
      caption: () => (
        <Trans>Load a Lichess CSV, follow its progress, or stop it.</Trans>
      ),
      permission: PERMISSION.puzzlesManage,
      opens: { kind: 'catalogue-load', load: chessCatalogueLoad },
    },
  ],
};
