import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { type JSX, Match, Show, Switch } from 'solid-js';

import { GamesMainMenu } from './games-main-menu';
import { SpaceActiveLayout } from './space-active-layout';
import { SpaceHostOfflineNotice } from './space-connection-notice';
import type { SpaceSessionUiValue } from './space-session-ui-context';
import { SpaceSessionUiProvider } from './space-session-ui-context';
import { SpacesNeedConnectionNotice } from './spaces-notices';
import { useAnnounceJoinedOnSync } from './use-announce-joined-on-sync';
import { useSpaceHostConnection } from './use-space-host-connection';

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
  const connection = useSpaceHostConnection();
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
          <Switch>
            <Match
              when={connection() === 'ready' || connection() === 'offline'}
            >
              <Show when={connection() === 'offline'}>
                <div class="box p-4">
                  <SpacesNeedConnectionNotice />
                </div>
              </Show>
              <GamesMainMenu />
            </Match>
            <Match when={connection() === 'host-offline'}>
              <div class="box p-4">
                <SpaceHostOfflineNotice />
              </div>
            </Match>
            <Match when={connection() === 'loading'}>
              <LoadingState />
            </Match>
          </Switch>
        </SpaceActiveLayout>
      </div>
    </SpaceSessionUiProvider>
  );
}
