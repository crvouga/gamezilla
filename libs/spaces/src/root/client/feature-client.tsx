/** @jsxImportSource solid-js */
/**
 * What spaces contributes to a client app: the lobby and space screens, the
 * Spaces tab, the miniplayer dock, and the providers a space needs — the game
 * module registry above the sync gate, and the open-room / modal context
 * inside it.
 */

import {
  defineFeatureClient,
  type FeatureClient,
} from '@libs/feature/public/client';
import { Handles } from '@libs/test-ids';
import { useLingui } from '@lingui/solid/macro';
import { Gamepad2Icon } from '@pkgs/ui';
import { type JSX, lazy, Suspense } from 'solid-js';

import { AppGamesProvider, type LoadGameRegistry } from './app/games-provider';

export type { GameRegistry, LoadGameRegistry } from './app/games-provider';

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

/**
 * The composition root injects the game-plugin registry loader: games depend
 * on spaces, so spaces cannot import them.
 */
export function createSpacesClient(options: {
  readonly loadGameRegistry: LoadGameRegistry;
}): FeatureClient {
  function SpacesChrome(props: {
    readonly children: JSX.Element;
  }): JSX.Element {
    return (
      <AppGamesProvider loadGameRegistry={options.loadGameRegistry}>
        {props.children}
      </AppGamesProvider>
    );
  }
  return defineFeatureClient({
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
    chrome: SpacesChrome,
    session: () => import('./app/session-provider'),
    tabsDock: SpacesDock,
  });
}
