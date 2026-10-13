import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import {
  createEffect,
  createSignal,
  type JSX,
  Match,
  Show,
  Switch,
} from 'solid-js';

import { ConnectionMissingNotice } from './connection-missing-notice';
import { GamesMainMenu } from './games-main-menu';
import { SpaceActiveLayout } from './space-active-layout';
import { SpaceHostOfflineNotice } from './space-connection-notice';
import type { SpaceSessionUiValue } from './space-session-ui-context';
import { SpaceSessionUiProvider } from './space-session-ui-context';
import { SpacesNeedConnectionNotice } from './spaces-notices';
import { useAnnounceJoinedOnSync } from './use-announce-joined-on-sync';
import { SpaceQuietHost } from './use-space-device-quiet';
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
  const engine = useSyncEngine();
  // Once the menu has been shown, a later host-offline check must not hide it.
  const [keptMenu, setKeptMenu] = createSignal(false);
  createEffect(() => {
    if (connection() !== 'loading') setKeptMenu(true);
  });
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
      <SpaceQuietHost>
        <SpaceActiveLayout>
          <Switch>
            <Match when={connection() === 'loading' && !keptMenu()}>
              <LoadingState />
            </Match>
            <Match when={connection() !== 'loading' || keptMenu()}>
              <Show when={!engine.status().online}>
                <div class="box p-4">
                  <ConnectionMissingNotice />
                </div>
              </Show>
              <Show when={connection() === 'offline'}>
                <div class="box p-4">
                  <SpacesNeedConnectionNotice />
                </div>
              </Show>
              <Show when={connection() === 'host-offline'}>
                <div class="box p-4">
                  <SpaceHostOfflineNotice />
                </div>
              </Show>
              <GamesMainMenu />
            </Match>
          </Switch>
        </SpaceActiveLayout>
      </SpaceQuietHost>
    </SpaceSessionUiProvider>
  );
}
