import {
  defineFeatureClient,
  type FeatureRoute,
} from '@libs/feature/public/client';
import { useLingui } from '@lingui/solid/macro';
import { Gamepad2Icon } from '@pkgs/ui';

function chessTabLabel(): string {
  const { t } = useLingui();
  return t`Chess`;
}

export function createMultiplayerChessClient(load: FeatureRoute['load']) {
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
        load,
        tab: true,
      },
      {
        path: '/chess/multiplayer/:gameId',
        load,
        tab: true,
      },
    ],
  });
}
