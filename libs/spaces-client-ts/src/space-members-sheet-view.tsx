import { Handles } from '@libs/test-ids-shared-ts/handles';
import { resolveParticipantColor } from '@pkgs/collab-root-shared-ts/participant-color';
import type { PresenceRosterRow } from '@pkgs/collab-ui-client-ts/presence-roster-list';
import { PresenceRosterList } from '@pkgs/collab-ui-client-ts/presence-roster-list';
import { Trans, useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import type { RoomActor } from '@pkgs/room-root-shared-ts/types';
import { Badge, HostBadge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { ScrollView } from '@pkgs/ui-root-client-ts/scroll-view';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from '@solidjs/web';
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
  /** Opens Share, right under the empty list's invitation. */
  readonly onShare?: (() => void) | undefined;
  /**
   * The host removes a guest from here as from Share: given, each guest's
   * row (never the host's or the viewer's own) offers Remove.
   */
  readonly onRemove?: ((person: SpacePerson) => void) | undefined;
};

function SpaceMemberBadges(props: {
  readonly member: SpaceMemberRow;
  readonly onRemove?: ((person: SpacePerson) => void) | undefined;
}): JSX.Element {
  const removable = (): SpacePerson | null =>
    props.onRemove !== undefined && !props.member.isHost && !props.member.isYou
      ? props.member.person
      : null;
  return (
    <StackHorizontal align="center" gap="xs">
      <Show when={props.member.isHost}>
        <HostBadge size="sm" />
      </Show>
      {/* A fact like Host beside it, in the neutral tag's full-ink text:
          small green on its pale green wash read too faint. */}
      <Show when={props.member.isThisTab}>
        <Badge
          label={<Trans>This device</Trans>}
          intent="neutral"
          tone="subtle"
          size="sm"
        />
      </Show>
      <Show when={removable()} keyed>
        {(person) => (
          <Button
            title={<Trans>Remove</Trans>}
            size="sm"
            intent="neutral"
            variant="outline"
            onClick={() => props.onRemove?.(person)}
            dataSet={{ testid: `space-member-remove-${person.id}` }}
          />
        )}
      </Show>
    </StackHorizontal>
  );
}

function rosterRow(
  member: SpaceMemberRow,
  you: string,
  unnamed: string,
  onRemove?: ((person: SpacePerson) => void) | undefined
): PresenceRosterRow {
  const id = member.actor.id;
  return {
    client: member.actor,
    // A person reads names: "You" for themself, everyone else's username.
    // A person whose profile has not arrived yet still has a name to read.
    // Status reads with the name (Idle, like Bot, right after it); the
    // right edge keeps only the role and the host's Remove, so every row's
    // controls line up.
    title: (
      // The name in full, breaking anywhere a long one must, so the host can
      // tell who they are removing; Idle reads under it, never squeezing it.
      <StackVertical gap="xs" grow>
        {member.isYou ? (
          you
        ) : member.person === null ? (
          unnamed
        ) : (
          <SpacePersonName
            person={member.person}
            lines={3}
            wrap="break"
            testId={Handles.spaceMemberName(id)}
          />
        )}
        <Show when={member.idle}>
          <StackHorizontal>
            <Badge
              label={<Trans>Idle</Trans>}
              intent="neutral"
              tone="subtle"
              size="sm"
              dataSet={{ testid: Handles.spaceMemberIdle(id) }}
            />
          </StackHorizontal>
        </Show>
      </StackVertical>
    ),
    isYou: member.isYou,
    isThisTab: member.isThisTab,
    idle: member.idle,
    badges: <SpaceMemberBadges member={member} onRemove={onRemove} />,
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
    props.members.map((member) =>
      rosterRow(member, t`You`, t`Guest`, props.onRemove)
    )
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
              title={<Trans>No one else is here yet</Trans>}
              body={<Trans>Share the space link to invite people.</Trans>}
              action={
                props.onShare === undefined
                  ? undefined
                  : { label: <Trans>Share</Trans>, onClick: props.onShare }
              }
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
