import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { NoteActivity } from '@libs/spaces-shared-ts/space-activity';
import { isViewingSpaceClient } from '@libs/spaces-shared-ts/space-presence-client-id';
import { useClock } from '@pkgs/clock-client-ts/solid';
import type { JSX } from '@solidjs/web';
import { createSignal, Show } from 'solid-js';
import { RemoveSpacePersonModal } from './remove-space-person-modal';
import { RenameSpaceModal } from './rename-space-modal';
import { SpaceManagement } from './space-management';
import {
  type SpaceManagementPage,
  useSpaceManagement,
} from './space-management-context';
import type { SpacePerson } from './space-person-view';
import { useSpaceRoomClientId } from './space-room-context';
import { useSpaceCan } from './use-space-can';
import { useSpaceRoomDispatch } from './use-space-room-selector';

export function useSpaceOverlays() {
  const clock = useClock();
  const [page, navigate] = useSpaceManagement();
  const dispatch = useSpaceRoomDispatch();
  const clientId = useSpaceRoomClientId();
  const [removing, setRemoving] = createSignal<SpacePerson | null>(null);
  function openMembers(): void {
    const id = clientId();
    if (id !== null && isViewingSpaceClient(id)) {
      dispatch(NoteActivity({ clientId: id, at: clock.now() }));
    }
    navigate({ area: 'people', tab: 'people' });
  }
  return {
    page,
    navigate,
    openMembers,
    removing,
    setRemoving,
    openSharing: () => navigate({ area: 'people', tab: 'sharing' }),
    openSettings: () => navigate({ area: 'settings', tab: 'general' }),
  };
}

export type SpaceOverlays = ReturnType<typeof useSpaceOverlays>;

export function SpaceScreenOverlays(props: {
  readonly spaceId: string;
  readonly spaceName: string;
  readonly canManage: boolean;
  readonly overlays: SpaceOverlays;
}): JSX.Element {
  const canRename = useSpaceCan(() => props.spaceId, PERMISSION.spacesRename);
  const [renaming, setRenaming] = createSignal(false);
  const page = (): SpaceManagementPage | null => {
    const current = props.overlays.page();
    if (current?.area === 'settings' && !props.canManage) return null;
    return current;
  };
  const editing = () =>
    page()?.area === 'settings' && canRename() && renaming();
  return (
    <>
      <Show when={!editing() && page()}>
        {(current) => (
          <SpaceManagement
            spaceId={props.spaceId}
            spaceName={props.spaceName}
            page={current()}
            onNavigate={props.overlays.navigate}
            onClose={() => props.overlays.navigate(null)}
            onRename={canRename() ? () => setRenaming(true) : undefined}
          />
        )}
      </Show>
      <Show when={editing()}>
        <RenameSpaceModal
          spaceId={props.spaceId}
          visible
          onClose={() => setRenaming(false)}
        />
      </Show>
      <Show when={props.overlays.removing()} keyed>
        {(person) => (
          <RemoveSpacePersonModal
            spaceId={props.spaceId}
            person={person}
            onClose={() => props.overlays.setRemoving(null)}
          />
        )}
      </Show>
    </>
  );
}
