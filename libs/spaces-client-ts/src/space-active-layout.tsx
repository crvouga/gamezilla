import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { NoteActivity } from '@libs/spaces-shared-ts/space-activity';
import { isViewingSpaceClient } from '@libs/spaces-shared-ts/space-presence-client-id';
import { useClock } from '@pkgs/clock-client-ts/solid';
import type { JSX } from 'solid-js';
import { createSignal } from 'solid-js';
import type { SpaceDetailStatus } from './space-detail-screen-view';
import { SpaceDetailScreenView } from './space-detail-screen-view';
import { useSpaceMembersDialog } from './space-members-dialog-context';
import { SpaceMembersListModal } from './space-members-list-modal';
import {
  SpacePresenceStrip,
  useSpacePresenceCount,
} from './space-presence-strip';
import { SpaceRefusedChangeNotice } from './space-refused-change-notice';
import { useSpaceRoomClientId } from './space-room-context';
import { useSpaceSessionUi } from './space-session-ui-context';
import { SpaceShareSheet } from './space-share-sheet';
import {
  useSpacesNavBack,
  useSpacesNavBackLabel,
  useSpacesNavPlace,
} from './spaces-nav-context';
import { useSpaceCan } from './use-space-can';
import { useSpaceDisplayTitle } from './use-space-display-title';
import { useSpaceRoomDispatch } from './use-space-room-selector';

export type SpaceActiveLayoutProps = {
  readonly hostOffline: boolean;
  readonly status: SpaceDetailStatus;
  readonly children?: JSX.Element;
};

/** Opening the members list also counts as activity in the space. */
function useOpenMembers(): () => void {
  const clock = useClock();
  const membersDialog = useSpaceMembersDialog();
  const dispatch = useSpaceRoomDispatch();
  const clientId = useSpaceRoomClientId();
  return () => {
    const id = clientId();
    if (id !== null && isViewingSpaceClient(id)) {
      dispatch(NoteActivity({ clientId: id, at: clock.now() }));
    }
    membersDialog.setOpen(true);
  };
}

/**
 * Wires {@link SpaceDetailScreenView} to the space session: its title,
 * what the viewer may do, the nav back handler, and the members / share
 * surfaces it opens.
 */
export function SpaceActiveLayout(props: SpaceActiveLayoutProps): JSX.Element {
  const sessionUi = useSpaceSessionUi();
  const title = useSpaceDisplayTitle(() => sessionUi.spaceId);
  const onPressBack = useSpacesNavBack();
  const backLabel = useSpacesNavBackLabel();
  const place = useSpacesNavPlace();
  const membersDialog = useSpaceMembersDialog();
  const onPressMembers = useOpenMembers();
  const [shareOpen, setShareOpen] = createSignal(false);
  const presenceCount = useSpacePresenceCount();
  const canRename = useSpaceCan(
    () => sessionUi.spaceId,
    PERMISSION.spacesRename
  );
  const canEnd = useSpaceCan(() => sessionUi.spaceId, PERMISSION.spacesEnd);

  return (
    <SpaceDetailScreenView
      title={title()}
      spaceId={sessionUi.spaceId}
      place={place()}
      status={props.status}
      hostOffline={props.hostOffline}
      canRename={canRename()}
      canEnd={canEnd()}
      presenceCount={presenceCount()}
      presence={(size, compact) => (
        <SpacePresenceStrip
          spaceId={sessionUi.spaceId}
          size={size}
          compact={compact}
        />
      )}
      notice={<SpaceRefusedChangeNotice />}
      overlays={
        <>
          <SpaceMembersListModal
            spaceId={sessionUi.spaceId}
            visible={membersDialog.open()}
            onClose={() => membersDialog.setOpen(false)}
          />
          <SpaceShareSheet
            spaceId={sessionUi.spaceId}
            open={shareOpen()}
            onOpenChange={setShareOpen}
          />
        </>
      }
      onPressHome={sessionUi.onPressHome}
      onPressBack={onPressBack()}
      backLabel={backLabel()}
      onPressMembers={onPressMembers}
      onPressShare={() => setShareOpen(true)}
      onPressRename={sessionUi.onRequestRename}
      onPressEnd={sessionUi.onRequestEnd}
      onPressLeave={sessionUi.onRequestLeave}
    >
      {props.children}
    </SpaceDetailScreenView>
  );
}
