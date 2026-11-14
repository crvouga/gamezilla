import { chessCatalogueLoad } from '@libs/chess-puzzle-client-ts/chess-catalogue-load';
import type { GameSettings } from '@libs/game-menu-client-ts/game-settings';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { Trans } from '@lingui/solid/macro';

/**
 * Chess's settings, as data the platform draws: the developer tools, which
 * hold the puzzle loader for a person allowed to manage puzzles.
 */
export const chessSettings: GameSettings = {
  caption: () => <Trans>Developer tools for puzzles</Trans>,
  rows: [
    {
      key: 'developer',
      title: () => <Trans>Developer</Trans>,
      caption: () => <Trans>Import and manage chess puzzles</Trans>,
      opens: {
        kind: 'group',
        subtitle: () => <Trans>Import and manage chess puzzles.</Trans>,
        rows: [
          {
            key: 'puzzles',
            title: () => <Trans>Load chess puzzles</Trans>,
            caption: () => (
              <Trans>
                Load a Lichess CSV, follow its progress, or stop it.
              </Trans>
            ),
            permission: PERMISSION.puzzlesManage,
            opens: { kind: 'catalogue-load', load: chessCatalogueLoad },
          },
        ],
      },
    },
  ],
};
