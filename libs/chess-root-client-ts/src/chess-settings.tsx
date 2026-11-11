import { chessCatalogueLoad } from '@libs/chess-puzzle-client-ts/chess-catalogue-load';
import type { GameSettings } from '@libs/game-menu-client-ts/game-settings';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { Trans } from '@lingui/solid/macro';

/**
 * Chess's settings, as data the platform draws: the developer tools, which
 * hold the puzzle loader for a person allowed to manage puzzles.
 */
export const chessSettings: GameSettings = {
  caption: () => <Trans>Preferences and developer tools</Trans>,
  subtitle: () => <Trans>Developer tools.</Trans>,
  rows: [
    {
      key: 'developer',
      title: () => <Trans>Developer</Trans>,
      caption: () => <Trans>Puzzle import tools.</Trans>,
      opens: {
        kind: 'group',
        subtitle: () => <Trans>Import and manage puzzle content.</Trans>,
        rows: [
          {
            key: 'puzzles',
            title: () => <Trans>Load chess puzzles</Trans>,
            caption: () => (
              <Trans>
                Load Lichess CSV, follow progress, and stop loading.
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
