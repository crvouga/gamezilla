import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { JSX } from '@solidjs/web';
import { createEffect, createSignal } from 'solid-js';

import { GamesMainMenu } from './games-main-menu';
import { SpaceScreenChromeProvider } from './space-screen-chrome';
import { SpaceScreenFrame } from './space-screen-frame';
import type { SpaceSessionUiValue } from './space-session-ui-context';
import { SpaceSessionUiProvider } from './space-session-ui-context';
import { useAnnounceJoinedOnSync } from './use-announce-joined-on-sync';
import { useNoteSpaceActivity } from './use-note-space-activity';
import { SpaceQuietHost } from './use-space-device-quiet';
import { useSpaceHostConnection } from './use-space-host-connection';

export type ActiveSpaceBodyProps = {
  spaceId: string;
  onRequestEnd: () => void;
  onRequestLeave: () => void;
  onPressHome: () => void;
};

/**
 * Body of an active space session: the space's chrome and frame around the
 * games main menu. Session UI is provided via {@link SpaceSessionUiProvider};
 * room state uses registry hooks under {@link SpaceRoomProvider}.
 */
export function ActiveSpaceBody(props: ActiveSpaceBodyProps): JSX.Element {
  useAnnounceJoinedOnSync(() => props.spaceId);
  useNoteSpaceActivity();
  const connection = useSpaceHostConnection();
  const engine = useSyncEngine();
  const [keptMenu, setKeptMenu] = createSignal(false);
  createEffect(
    () => connection() !== 'loading',
    (known) => {
      if (known) setKeptMenu(true);
    }
  );
  const sessionUi: SpaceSessionUiValue = {
    get spaceId() {
      return props.spaceId;
    },
    get onRequestEnd() {
      return () => props.onRequestEnd();
    },
    get onRequestLeave() {
      return () => props.onRequestLeave();
    },
    get onPressHome() {
      return () => props.onPressHome();
    },
  };

  // The game choice stays while the host is offline. A first look waits
  // until the host is known; once the menu has shown, a later check does
  // not hide it.
  const gamesLoading = (): boolean =>
    connection() === 'loading' && engine.status().online && !keptMenu();
  const status = () => (gamesLoading() ? 'loading' : 'ready');
  const hostOffline = (): boolean =>
    connection() === 'host-offline' && engine.status().online;

  return (
    <SpaceSessionUiProvider value={sessionUi}>
      <SpaceQuietHost>
        <SpaceScreenChromeProvider
          status={status()}
          hostOffline={hostOffline()}
        >
          <SpaceScreenFrame>
            <GamesMainMenu />
          </SpaceScreenFrame>
        </SpaceScreenChromeProvider>
      </SpaceQuietHost>
    </SpaceSessionUiProvider>
  );
}
