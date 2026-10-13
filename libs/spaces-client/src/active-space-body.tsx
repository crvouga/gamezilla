import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { type JSX, Match, Show, Switch } from 'solid-js';

import { GamesMainMenu } from './games-main-menu';
import { SpaceActiveLayout } from './space-active-layout';
import { SpaceConnectionMissingNotice } from './space-connection-missing';
import { SpaceHostOfflineNotice } from './space-connection-notice';
import type { SpaceSessionUiValue } from './space-session-ui-context';
import { SpaceSessionUiProvider } from './space-session-ui-context';
import { useAnnounceJoinedOnSync } from './use-announce-joined-on-sync';
import { useNoteSpaceActivity } from './use-note-space-activity';
import { useSpaceHostConnection } from './use-space-host-connection';

type HostConnection = 'ready' | 'loading' | 'offline' | 'host-offline';

/**
 * The game choice stays while the host is offline. The notice beside it
 * says the host is offline; hiding the choice would leave a guest nowhere.
 */
function SpaceGames(props: {
  connection: HostConnection;
  online: boolean;
}): JSX.Element {
  return (
    <Switch fallback={<GamesMainMenu />}>
      <Match when={props.connection === 'loading' && props.online}>
        <LoadingState />
      </Match>
    </Switch>
  );
}

export type ActiveSpaceBodyProps = {
  spaceId: string;
  onRequestEnd: () => void;
  onRequestLeave: () => void;
  onRequestRename: () => void;
  onPressHome: () => void;
};

/**
 * Body of an active space session: chrome layout + games main menu. Session
 * UI is provided via {@link SpaceSessionUiProvider}; room state uses registry
 * hooks under {@link SpaceRoomProvider}.
 */
export function ActiveSpaceBody(props: ActiveSpaceBodyProps): JSX.Element {
  useAnnounceJoinedOnSync(props.spaceId);
  useNoteSpaceActivity();
  const connection = useSpaceHostConnection();
  const engine = useSyncEngine();
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
    get onRequestRename() {
      return () => props.onRequestRename();
    },
    get onPressHome() {
      return () => props.onPressHome();
    },
  };

  return (
    <SpaceSessionUiProvider value={sessionUi}>
      <div class="box flex-1 min-h-0">
        <SpaceActiveLayout>
          <Show when={!engine.status().online}>
            <div class="box p-4">
              <SpaceConnectionMissingNotice />
            </div>
          </Show>
          <Show
            when={connection() === 'host-offline' && engine.status().online}
          >
            <div class="box p-4">
              <SpaceHostOfflineNotice />
            </div>
          </Show>
          <SpaceGames
            connection={connection()}
            online={engine.status().online}
          />
        </SpaceActiveLayout>
      </div>
    </SpaceSessionUiProvider>
  );
}
