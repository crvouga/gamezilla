import { useMyId } from '@libs/auth-client/use-current-user';
import { UserProfileAvatar } from '@libs/profile-client/user-profile-avatar';
import { UserUsername } from '@libs/profile-client/user-username';
import {
  memberIsIdle,
  SpaceQuietRoomAttr,
} from '@libs/spaces-shared/space-quiet';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { groupRosterByParticipant } from '@pkgs/collab-root-shared/group-roster';
import type { PresenceRosterRow } from '@pkgs/collab-ui-client/presence-roster-list';
import { PresenceRosterList } from '@pkgs/collab-ui-client/presence-roster-list';
import { Badge } from '@pkgs/ui-root-client/badge';
import { ResponsiveSurface } from '@pkgs/ui-root-client/responsive-surface';
import { ScrollView } from '@pkgs/ui-root-client/scroll-view';
import type { JSX } from 'solid-js';
import { createEffect, createMemo, Show } from 'solid-js';
import { useSpaceRoomClientId } from './space-room-context';
import { useConnectedSpaceRoster } from './use-connected-space-roster';
import { useMemberRole } from './use-member-role';
import { useClearSpaceQuiet } from './use-space-device-quiet';
import { useSpaceParticipantColors } from './use-space-participant-colors';
import { useSpaceRoomSelector } from './use-space-room-selector';

export type SpaceMembersListModalProps = {
  spaceId: string;
  visible: boolean;
  onClose: () => void;
};

/**
 * Modal listing connected people (one row per person). Uses
 * {@link ResponsiveSurface} (bottom sheet on mobile, centered modal on wider
 * viewports).
 */
export function SpaceMembersListModal(
  props: SpaceMembersListModalProps
): JSX.Element {
  const { t } = useLingui();
  const myId = useMyId();
  const roster = useConnectedSpaceRoster();
  const colors = useSpaceParticipantColors(props.spaceId);
  const selfClientId = useSpaceRoomClientId();
  const quiet = useSpaceRoomSelector(SpaceQuietRoomAttr.quiet.from);
  const clearQuiet = useClearSpaceQuiet();
  createEffect(() => {
    if (props.visible) clearQuiet();
  });

  const rows = createMemo<readonly PresenceRosterRow[]>(() => {
    const grouped = groupRosterByParticipant(roster(), selfClientId());
    const out: PresenceRosterRow[] = [];
    for (const participant of grouped) {
      const client = participant.clients[0];
      if (client === undefined) continue;
      const clientIds = participant.clients.map((entry) => entry.clientId);
      out.push({
        client,
        title: (
          <UserUsername
            profileId={client.id}
            withAt={false}
            dataSet={{ testid: Handles.spaceMemberName(client.id) }}
          />
        ),
        isYou: participant.isYou,
        isThisTab: clientIds.includes(selfClientId() ?? ''),
        badges: (
          <SpaceMemberBadges
            spaceId={props.spaceId}
            memberId={client.id}
            myId={myId()}
            isThisTab={clientIds.includes(selfClientId() ?? '')}
            isIdle={memberIsIdle(quiet(), clientIds)}
          />
        ),
        dataSet: { testid: Handles.spaceMemberRow(client.id) },
      });
    }
    return out;
  });

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
  isIdle: boolean;
}): JSX.Element {
  const role = useMemberRole(props.spaceId, props.memberId);
  return (
    <div class="box flex-row gap-1 items-center">
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
      <Show when={props.isIdle}>
        <Badge
          label={<Trans>Idle</Trans>}
          intent="neutral"
          tone="subtle"
          size="sm"
          dataSet={{ testid: Handles.spaceMemberIdle(props.memberId) }}
        />
      </Show>
    </div>
  );
}
