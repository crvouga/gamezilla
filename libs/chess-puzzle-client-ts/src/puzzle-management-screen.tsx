import { CatalogueLoadScreen } from '@libs/game-puzzle-client-ts/catalogue-load-screen';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import type { JSX } from '@solidjs/web';
import { chessCatalogueLoad } from './chess-catalogue-load';

export function PuzzleManagementScreen(): JSX.Element {
  return (
    <CatalogueLoadScreen
      client={chessCatalogueLoad}
      frame={{
        kind: 'route',
        parent: { name: <Trans>Dashboard</Trans>, href: '/' },
      }}
    />
  );
}
