import { useMyId } from '@libs/auth-client/use-current-user';
import { UserProfileAvatar } from '@libs/profile-client/user-profile-avatar';
import { UserUsername } from '@libs/profile-client/user-username';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import type { PresenceRosterRow } from '@pkgs/collab-ui-client/presence-roster-list';
import { PresenceRosterList } from '@pkgs/collab-ui-client/presence-roster-list';
import type { RoomActor } from '@pkgs/room-root-shared/types';
import { Badge } from '@pkgs/ui-root-client/badge';
import { ResponsiveSurface } from '@pkgs/ui-root-client/responsive-surface';
import { ScrollView } from '@pkgs/ui-root-client/scroll-view';
import type { JSX } from 'solid-js';
import { createEffect, createMemo, Show } from 'solid-js';
import { useSpaceRoomClientId } from './space-room-context';
import { useMemberRole } from './use-member-role';
import { useOpenSpacePresence } from './use-open-space-presence';
import { useClearSpaceQuiet } from './use-space-device-quiet';
import { useSpaceParticipantColors } from './use-space-participant-colors';

export type SpaceMembersListModalProps = {
  spaceId: string;
  visible: boolean;
  onClose: () => void;
};

/**
 * People in the space, one row each. Uses {@link ResponsiveSurface}
 * (bottom sheet on mobile, centered modal on wider viewports).
 */
export function SpaceMembersListModal(
  props: SpaceMembersListModalProps
): JSX.Element {
  const { t } = useLingui();
  const myId = useMyId();
  const presence = useOpenSpacePresence(props.spaceId);
  const colors = useSpaceParticipantColors(props.spaceId);
  const selfClientId = useSpaceRoomClientId();
  const clearQuiet = useClearSpaceQuiet();
  createEffect(() => {
    if (props.visible) clearQuiet();
  });

  const rows = createMemo<readonly PresenceRosterRow[]>(() =>
    presence.people().map((person) => {
      const client: RoomActor = { id: person.id, clientId: person.clientId };
      const isThisTab = person.clientId === selfClientId();
      return {
        client,
        title: (
          <UserUsername
            profileId={person.id}
            withAt={false}
            dataSet={{ testid: Handles.spaceMemberName(person.id) }}
          />
        ),
        isYou: person.id === myId(),
        isThisTab,
        badges: (
          <SpaceMemberBadges
            spaceId={props.spaceId}
            memberId={person.id}
            myId={myId()}
            isThisTab={isThisTab}
            idle={presence.idle().has(person.id)}
          />
        ),
        dataSet: { testid: Handles.spaceMemberRow(person.id) },
      };
    })
  );

  // A person reads names: "You" for themself, everyone else's username.
  const titledRows = createMemo<readonly PresenceRosterRow[]>(() =>
    rows().map((row) =>
      row.client.id === myId() ? { ...row, title: t`You` } : row
    )
  );

  return (
    <ResponsiveSurface
      visible={props.visible}
      onClose={props.onClose}
      title={<Trans>People in this space</Trans>}
      scroll={false}
      closeDataSet={{ testid: Handles.spaceMembersClose }}
    >
      <ScrollView class="max-h-105" contentClass="px-0">
        <Show
          when={titledRows().length > 0}
          fallback={<Trans>No one connected yet</Trans>}
        >
          <PresenceRosterList
            rows={titledRows()}
            colorForParticipant={(id) => colors.colorForParticipant(id)}
            renderAvatar={(actor, size) => (
              <UserProfileAvatar profileId={actor.id} size={size} />
            )}
          />
        </Show>
        <span
          data-testid={Handles.spacePresenceCount}
          class="hidden"
          aria-hidden="true"
        >
          {titledRows().length}
        </span>
      </ScrollView>
    </ResponsiveSurface>
  );
}

function SpaceMemberBadges(props: {
  spaceId: string;
  memberId: string;
  myId: string;
  isThisTab: boolean;
  idle: boolean;
}): JSX.Element {
  const role = useMemberRole(props.spaceId, props.memberId);
  return (
    <div class="box flex-row gap-1 items-center">
      <Show when={props.idle}>
        <Badge
          label={<Trans>Idle</Trans>}
          intent="neutral"
          tone="subtle"
          size="sm"
          dataSet={{ testid: Handles.spaceMemberIdle(props.memberId) }}
        />
      </Show>
      <Show when={role() === 'host'}>
        <Badge
          label={<Trans>Host</Trans>}
          intent="brand"
          tone="subtle"
          size="sm"
        />
      </Show>
      <Show when={props.memberId === props.myId}>
        <Badge
          label={<Trans>You</Trans>}
          intent="info"
          tone="subtle"
          size="sm"
        />
      </Show>
      <Show when={props.isThisTab}>
        <Badge
          label={<Trans>This tab</Trans>}
          intent="success"
          tone="subtle"
          size="sm"
        />
      </Show>
    </div>
  );
}
