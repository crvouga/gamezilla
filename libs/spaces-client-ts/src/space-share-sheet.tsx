import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { createMemo, createSignal, type JSX, Show } from 'solid-js';
import { RemoveSpacePersonModal } from './remove-space-person-modal';
import type { SpacePerson } from './space-person-view';
import { SpaceShareAddPeople } from './space-share-add-people';
import { SpaceShareSheetView } from './space-share-sheet-view';
import { useSpaceCan } from './use-space-can';
import { useSpaceHostMembershipDisplay } from './use-space-host-membership-display';
import { useSpacePeople } from './use-space-people';
import { useSpaceUserEntries } from './use-space-user-entries';

export type SpaceShareSheetProps = {
  readonly spaceId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

function spaceShareUrl(spaceId: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/space/${spaceId}`;
  }
  return `/space/${spaceId}`;
}

/** Wires {@link SpaceShareSheetView} to the space's people and its link. */
export function SpaceShareSheet(props: SpaceShareSheetProps): JSX.Element {
  const canManageMembers = useSpaceCan(
    () => props.spaceId,
    PERMISSION.spacesManageMembers
  );
  const { entries, isLoading } = useSpaceUserEntries(props.spaceId);
  const people = useSpacePeople(() => entries().map((e) => e.userId));
  const listedIds = createMemo(() => new Set(entries().map((e) => e.userId)));
  const host = useSpaceHostMembershipDisplay(props.spaceId);
  const [removing, setRemoving] = createSignal<SpacePerson | null>(null);

  return (
    <SpaceShareSheetView
      open={props.open}
      onClose={() => props.onOpenChange(false)}
      onCopyLink={async () => {
        await navigator.clipboard.writeText(spaceShareUrl(props.spaceId));
      }}
      canManage={canManageMembers()}
      addPeople={
        <SpaceShareAddPeople spaceId={props.spaceId} listedIds={listedIds()} />
      }
      peopleStatus={isLoading() ? 'loading' : 'ready'}
      people={people()}
      hostId={host()?.profileId ?? null}
      onRemovePerson={setRemoving}
      overlay={
        <Show when={removing()} keyed>
          {(person) => (
            <RemoveSpacePersonModal
              spaceId={props.spaceId}
              person={person}
              onClose={() => setRemoving(null)}
            />
          )}
        </Show>
      }
    />
  );
}
