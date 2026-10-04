import type { JSX } from 'solid-js';

import { GamesMainMenu } from './games-main-menu';
import { useAnnounceJoinedOnSync } from './use-announce-joined-on-sync';
import { SpaceActiveLayout } from './space-active-layout';
import { SpaceSessionUiProvider } from './space-session-ui-context';
import type { SpaceSessionUiValue } from './space-session-ui-context';

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
          <GamesMainMenu />
        </SpaceActiveLayout>
      </div>
    </SpaceSessionUiProvider>
  );
}
