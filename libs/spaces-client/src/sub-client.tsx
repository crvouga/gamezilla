import SessionProvider from './session-provider';
import SpaceScreen from './space';
import { SpaceMiniplayer } from './space-miniplayer';
import SpacesScreen from './spaces';
/** @jsxImportSource solid-js */
/**
 * What spaces contributes to a client app: the lobby and space screens, the
 * Spaces tab, the miniplayer dock, and the providers a space needs — the game
 * module registry above the sync gate, and the open-room / modal context
 * inside it.
 */

import type { SubClient } from '@libs/sub-client/client';
import { defineSubClient } from '@libs/sub-client/client';
import { Handles } from '@libs/test-ids-shared/handles';
import { useLingui } from '@lingui/solid/macro';
import { Gamepad2Icon } from '@pkgs/ui-root-client/icons';
import type { JSX } from 'solid-js';
import type { GameRegistry } from './games-provider';
import { AppGamesProvider } from './games-provider';
import {
  createSpaceHostingsInFlight,
  SpaceHostingsInFlightContext,
} from './space-hostings-in-flight';

/** Read inside the tab memo, so the label follows the active locale. */
function spacesTabLabel(): string {
  const { t } = useLingui();
  return t`Spaces`;
}

/**
 * The composition root injects the game-plugin registry: games depend
 * on spaces, so spaces cannot import them.
 */
export function createSpacesClient(options: {
  readonly registry: GameRegistry;
}): SubClient {
  function SpacesChrome(props: {
    readonly children: JSX.Element;
  }): JSX.Element {
    // Once per client, above the session remounts: a space created just
    // before a remount is still waited on by the room that opens after it.
    const hostings = createSpaceHostingsInFlight();
    return (
      <SpaceHostingsInFlightContext.Provider value={hostings}>
        <AppGamesProvider registry={options.registry}>
          {props.children}
        </AppGamesProvider>
      </SpaceHostingsInFlightContext.Provider>
    );
  }
  return defineSubClient({
    name: 'spaces',
    routes: [
      { path: '/', tab: true, component: SpacesScreen },
      { path: '/space/:id', component: SpaceScreen },
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
    session: SessionProvider,
    tabsDock: SpaceMiniplayer,
  });
}
