import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { resolveParticipantColor } from '@pkgs/collab-root-shared-ts/participant-color';
import type { PresenceRosterRow } from '@pkgs/collab-ui-client-ts/presence-roster-list';
import { PresenceRosterList } from '@pkgs/collab-ui-client-ts/presence-roster-list';
import type { RoomActor } from '@pkgs/room-root-shared-ts/types';
import { Badge, HostBadge } from '@pkgs/ui-root-client-ts/badge';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { ScrollView } from '@pkgs/ui-root-client-ts/scroll-view';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import { createMemo, Show } from 'solid-js';
import type { SpacePerson } from './space-person-view';
import { SpacePersonAvatar, SpacePersonName } from './space-person-view';
import type { SpacePresenceFace } from './space-presence-strip-view';
import { SpaceProbe } from './space-probe';

/** One person connected to the space, as the members list shows them. */
export type SpaceMemberRow = SpacePresenceFace & {
  /** The viewer: titled "You" and badged. */
  readonly isYou: boolean;
  /** The connection this browser tab holds. */
  readonly isThisTab: boolean;
  /** Present but not active lately. */
  readonly idle: boolean;
  readonly isHost: boolean;
};

export type SpaceMembersSheetViewProps = {
  readonly visible: boolean;
  readonly onClose: () => void;
  /** Connected people, in roster order. */
  readonly members: readonly SpaceMemberRow[];
};

function SpaceMemberBadges(props: {
  readonly member: SpaceMemberRow;
}): JSX.Element {
  return (
    <StackHorizontal align="center" gap="xs">
      <Show when={props.member.idle}>
        <Badge
          label={<Trans>Idle</Trans>}
          intent="neutral"
          tone="subtle"
          size="sm"
          dataSet={{ testid: Handles.spaceMemberIdle(props.member.actor.id) }}
        />
      </Show>
      <Show when={props.member.isHost}>
        <HostBadge size="sm" />
      </Show>
      <Show when={props.member.isYou}>
        <Badge
          label={<Trans>You</Trans>}
          intent="info"
          tone="subtle"
          size="sm"
        />
      </Show>
      <Show when={props.member.isThisTab}>
        <Badge
          label={<Trans>This tab</Trans>}
          intent="success"
          tone="subtle"
          size="sm"
        />
      </Show>
    </StackHorizontal>
  );
}

function rosterRow(member: SpaceMemberRow, you: string): PresenceRosterRow {
  const id = member.actor.id;
  return {
    client: member.actor,
    // A person reads names: "You" for themself, everyone else's username.
    title: member.isYou ? (
      you
    ) : (
      <SpacePersonName
        person={member.person}
        testId={Handles.spaceMemberName(id)}
      />
    ),
    isYou: member.isYou,
    isThisTab: member.isThisTab,
    badges: <SpaceMemberBadges member={member} />,
    dataSet: { testid: Handles.spaceMemberRow(id) },
  };
}

/**
 * People in the space, one row each, with idle / host / you / this-tab
 * badges. A bottom sheet on phones, a centered modal on wider screens.
 */
export function SpaceMembersSheetView(
  props: SpaceMembersSheetViewProps
): JSX.Element {
  const { t } = useLingui();
  const rows = createMemo(() =>
    props.members.map((member) => rosterRow(member, t`You`))
  );
  const find = (id: string): SpaceMemberRow | undefined =>
    props.members.find((member) => member.actor.id === id);
  const personOf = (actor: RoomActor): SpacePerson | null =>
    find(actor.id)?.person ?? null;
  return (
    <ResponsiveSurface
      visible={props.visible}
      onClose={() => props.onClose()}
      title={<Trans>People in this space</Trans>}
      scroll={false}
      closeDataSet={{ testid: Handles.spaceMembersClose }}
    >
      <ScrollView maxHeight="lg">
        <Show
          when={rows().length > 0}
          fallback={
            <EmptyState
              variant="compact"
              title={<Trans>No one connected yet</Trans>}
              body={<Trans>Share the space link to invite people.</Trans>}
            />
          }
        >
          <PresenceRosterList
            rows={rows()}
            colorForParticipant={(id) =>
              find(id)?.color ?? resolveParticipantColor(id)
            }
            renderAvatar={(actor, size) => (
              <SpacePersonAvatar person={personOf(actor)} size={size} />
            )}
          />
        </Show>
        <SpaceProbe testId={Handles.spacePresenceCount}>
          {rows().length}
        </SpaceProbe>
      </ScrollView>
    </ResponsiveSurface>
  );
}
