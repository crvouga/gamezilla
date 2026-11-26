import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import type { JSX } from '@solidjs/web';
import { createMemo, createSignal } from 'solid-js';
import { useRemoveSpacePersonStep } from './remove-space-person-step';
import {
  SpaceManagementView,
  type SpaceManagementViewProps,
} from './space-management-view';
import { SpaceMemberRoster } from './space-member-roster';
import type { SpacePerson } from './space-person-view';
import { SpaceShareAddPeople } from './space-share-add-people';
import { SpaceSharingPanel } from './space-sharing-panel';
import { useRemoveSpaceUser } from './use-remove-space-user';
import { useSpaceCan } from './use-space-can';
import { useSpaceHostMembershipDisplay } from './use-space-host-membership-display';
import { useSpacePeople } from './use-space-people';
import { useSpaceUserEntries } from './use-space-user-entries';

type Props = Pick<
  SpaceManagementViewProps,
  'page' | 'spaceName' | 'onNavigate' | 'onClose' | 'onRename'
> & { readonly spaceId: string };

function spaceShareUrl(spaceId: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/space/${spaceId}`;
  }
  return `/space/${spaceId}`;
}

/** The shared People and Settings pages with live space data. */
export function SpaceManagement(props: Props): JSX.Element {
  const myId = useMyId();
  const canManageMembers = useSpaceCan(
    () => props.spaceId,
    PERMISSION.spacesManageMembers
  );
  const { entries, isLoading } = useSpaceUserEntries(() => props.spaceId);
  const people = useSpacePeople(() => entries().map((e) => e.userId));
  const listedIds = createMemo(() => new Set(entries().map((e) => e.userId)));
  const host = useSpaceHostMembershipDisplay(() => props.spaceId);
  const [removing, setRemoving] = createSignal<SpacePerson | null>(null);
  const remove = useRemoveSpaceUser();
  const removal = useRemoveSpacePersonStep({
    get name() {
      return removing()?.name ?? '';
    },
    onClose: () => setRemoving(null),
    operation: () => {
      const person = removing();
      return person === null
        ? Promise.resolve()
        : remove(props.spaceId, person.id);
    },
  });

  const requestRemove = (person: SpacePerson): void => {
    removal.reset();
    setRemoving(person);
  };
  return (
    <SpaceManagementView
      {...props}
      people={
        <SpaceMemberRoster
          spaceId={props.spaceId}
          visible={props.page.tab === 'people'}
          onShare={() =>
            props.onNavigate({ area: props.page.area, tab: 'sharing' })
          }
          onRemove={requestRemove}
        />
      }
      sharing={
        <SpaceSharingPanel
          onCopyLink={async () => {
            await navigator.clipboard.writeText(spaceShareUrl(props.spaceId));
          }}
          canManage={canManageMembers()}
          addPeople={
            <SpaceShareAddPeople
              spaceId={props.spaceId}
              listedIds={listedIds()}
            />
          }
          peopleStatus={isLoading() ? 'loading' : 'ready'}
          people={people()}
          hostId={host()?.profileId ?? null}
          viewerId={myId() === '' ? undefined : myId()}
          onRemovePerson={requestRemove}
        />
      }
      removal={removing() === null ? undefined : removal}
    />
  );
}
