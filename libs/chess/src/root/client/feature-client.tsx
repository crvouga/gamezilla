import { defineFeatureClient } from '@libs/feature/public/client';
import { useLingui } from '@lingui/solid/macro';
import { Gamepad2Icon } from '@pkgs/ui';

function chessTabLabel(): string {
  const { t } = useLingui();
  return t`Chess`;
}

export const CHESS_CLIENT = defineFeatureClient({
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
      load: () => import('./multiplayer-screen'),
      tab: true,
    },
    {
      path: '/chess/multiplayer/:gameId',
      load: () => import('./multiplayer-screen'),
      tab: true,
    },
  ],
});
