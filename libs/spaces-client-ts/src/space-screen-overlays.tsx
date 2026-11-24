import { NoteActivity } from '@libs/spaces-shared-ts/space-activity';
import { isViewingSpaceClient } from '@libs/spaces-shared-ts/space-presence-client-id';
import { useClock } from '@pkgs/clock-client-ts/solid';
import { type Accessor, createSignal, type JSX, Show } from 'solid-js';
import { RemoveSpacePersonModal } from './remove-space-person-modal';
import { RenameSpaceModal } from './rename-space-modal';
import { useSpaceMembersDialog } from './space-members-dialog-context';
import { SpaceMembersListModal } from './space-members-list-modal';
import type { SpacePerson } from './space-person-view';
import { useSpaceRoomClientId } from './space-room-context';
import { useSpaceShareDialog } from './space-share-dialog-context';
import { SpaceShareSheet } from './space-share-sheet';
import { useSpaceRoomDispatch } from './use-space-room-selector';

/**
 * The sheets and confirms a space's chrome opens over every screen in it:
 * share, the people in the space, rename, and removing a person.
 */
export type SpaceOverlays = {
  readonly shareOpen: Accessor<boolean>;
  readonly setShareOpen: (open: boolean) => void;
  readonly membersOpen: Accessor<boolean>;
  readonly setMembersOpen: (open: boolean) => void;
  /** Opens the people in the space; looking counts as activity in it. */
  readonly openMembers: () => void;
  readonly renameOpen: Accessor<boolean>;
  readonly setRenameOpen: (open: boolean) => void;
  readonly removing: Accessor<SpacePerson | null>;
  readonly setRemoving: (person: SpacePerson | null) => void;
};

/**
 * The overlays' state. Share and the people list keep the route's state, so
 * the view a person chose survives the chrome rebuilding while the space
 * reconnects; a screen outside the route keeps its own Share.
 */
export function useSpaceOverlays(): SpaceOverlays {
  const clock = useClock();
  const members = useSpaceMembersDialog();
  const dispatch = useSpaceRoomDispatch();
  const clientId = useSpaceRoomClientId();
  const shareDialog = useSpaceShareDialog();
  const [ownShareOpen, setOwnShareOpen] = createSignal(false);
  const [renameOpen, setRenameOpen] = createSignal(false);
  const [removing, setRemoving] = createSignal<SpacePerson | null>(null);
  return {
    shareOpen: () => shareDialog?.open() ?? ownShareOpen(),
    setShareOpen: (open) => {
      if (shareDialog === undefined) setOwnShareOpen(open);
      else shareDialog.setOpen(open);
    },
    membersOpen: members.open,
    setMembersOpen: (open) => members.setOpen(open),
    openMembers: () => {
      const id = clientId();
      if (id !== null && isViewingSpaceClient(id)) {
        dispatch(NoteActivity({ clientId: id, at: clock.now() }));
      }
      members.setOpen(true);
    },
    renameOpen,
    setRenameOpen,
    removing,
    setRemoving,
  };
}

/** Renders the overlays of {@link useSpaceOverlays} for one space. */
export function SpaceScreenOverlays(props: {
  readonly spaceId: string;
  readonly overlays: SpaceOverlays;
}): JSX.Element {
  return (
    <>
      <SpaceMembersListModal
        spaceId={props.spaceId}
        visible={props.overlays.membersOpen()}
        onClose={() => props.overlays.setMembersOpen(false)}
        onShare={() => {
          props.overlays.setMembersOpen(false);
          props.overlays.setShareOpen(true);
        }}
        onRemove={(person) => {
          props.overlays.setMembersOpen(false);
          props.overlays.setRemoving(person);
        }}
      />
      <SpaceShareSheet
        spaceId={props.spaceId}
        open={props.overlays.shareOpen()}
        onOpenChange={props.overlays.setShareOpen}
      />
      <RenameSpaceModal
        spaceId={props.spaceId}
        visible={props.overlays.renameOpen()}
        onClose={() => props.overlays.setRenameOpen(false)}
      />
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
