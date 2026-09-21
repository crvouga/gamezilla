/** @jsxImportSource solid-js */
/**
 * What spaces contributes to a client app: the lobby and space screens, the
 * Spaces tab, the miniplayer dock, and the providers a space needs — the game
 * module registry above the sync gate, and the open-room / modal context
 * inside it.
 */

import { defineFeatureClient } from '@libs/feature/public/client';
import { Handles } from '@libs/test-ids';
import { useLingui } from '@lingui/solid/macro';
import { Gamepad2Icon } from '@pkgs/ui';
import { type JSX, lazy, Suspense } from 'solid-js';

import { AppGamesProvider } from './app/games-provider';

/** Pulls space-room / mutation graphs that must stay off the shell entry. */
const SpaceMiniplayer = lazy(() =>
  import('./miniplayer/space-miniplayer').then((mod) => ({
    default: mod.SpaceMiniplayer,
  }))
);

function SpacesDock(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <SpaceMiniplayer />
    </Suspense>
  );
}

/** Read inside the tab memo, so the label follows the active locale. */
function spacesTabLabel(): string {
  const { t } = useLingui();
  return t`Spaces`;
}

export const SPACES_CLIENT = defineFeatureClient({
  name: 'spaces',
  routes: [
    { path: '/', tab: true, load: () => import('./routes/spaces') },
    { path: '/space/:id', load: () => import('./routes/space') },
  ],
  tabs: [
    {
      name: 'Spaces',
      href: '/',
      order: 0,
      label: spacesTabLabel,
      Icon: Gamepad2Icon,
      testID: Handles.tabSpaces,
    },
  ],
  chrome: AppGamesProvider,
  session: () => import('./app/session-provider'),
  tabsDock: SpacesDock,
});
