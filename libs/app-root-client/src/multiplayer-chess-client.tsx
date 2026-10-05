import type { FeatureRoute } from '@libs/feature-client/client';
import { defineFeatureClient } from '@libs/feature-client/client';
import { useLingui } from '@lingui/solid/macro';
import { Gamepad2Icon } from '@pkgs/ui-root-client/icons';

function chessTabLabel(): string {
  const { t } = useLingui();
  return t`Chess`;
}

/** Chess's tab and routes; `routes` adds chess's other screens (puzzle links). */
export function createMultiplayerChessClient(
  component: FeatureRoute['component'],
  routes: readonly FeatureRoute[] = []
) {
  return defineFeatureClient({
    name: 'chess',
    tabs: [
      {
        name: 'Chess',
        href: '/chess/multiplayer',
        order: 4,
        label: chessTabLabel,
        Icon: Gamepad2Icon,
        testID: 'tab-chess',
      },
    ],
    routes: [
      {
        path: '/chess/multiplayer',
        component,
        tab: true,
      },
      {
        path: '/chess/multiplayer/:gameId',
        component,
        tab: true,
      },
      ...routes,
    ],
  });
}
