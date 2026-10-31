import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { HostBadge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { H3 } from '@pkgs/ui-root-client-ts/heading';
import { List } from '@pkgs/ui-root-client-ts/list';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { createMemo, createSignal, For, Show } from 'solid-js';
import { RemoveSpacePersonModal } from './remove-space-person-modal';
import { SpaceShareUserRow } from './space-share-user-row';
import { useSpaceHostMembershipDisplay } from './use-space-host-membership-display';
import type { SpaceUserEntry } from './use-space-user-entries';
import { useSpaceUserEntries } from './use-space-user-entries';

export function SpaceSharePeopleList(props: {
  readonly spaceId: string;
  readonly canManage: boolean;
}): JSX.Element {
  const { entries, isLoading } = useSpaceUserEntries(props.spaceId);
  const host = useSpaceHostMembershipDisplay(props.spaceId);
  const hostProfileId = createMemo(() => host()?.profileId ?? null);
  const [removing, setRemoving] = createSignal<SpaceUserEntry | null>(null);

  return (
    <>
      <StackVertical gap="sm">
        <H3 size="label">
          <Trans>People with access</Trans>
        </H3>
        <P variant="caption">
          <Trans>
            Added people find this space in their lobby and choose Join. Anyone
            with the space link can also join.
          </Trans>
        </P>
        <Show when={isLoading()}>
          <LoadingState variant="compact" size="sm" />
        </Show>
        <Show when={!isLoading() && entries().length === 0}>
          <EmptyState
            variant="compact"
            title={<Trans>No one added yet</Trans>}
            body={<Trans>Share the space link to invite people.</Trans>}
          />
        </Show>
        <Show when={entries().length > 0}>
          <List>
            <For each={entries()}>
              {(entry) => (
                <PeopleAccessRow
                  spaceId={props.spaceId}
                  entry={entry}
                  isHost={hostProfileId() === entry.userId}
                  canManage={props.canManage}
                  onRemove={() => setRemoving(entry)}
                />
              )}
            </For>
          </List>
        </Show>
      </StackVertical>
      <Show when={removing()} keyed>
        {(person) => (
          <RemoveSpacePersonModal
            spaceId={props.spaceId}
            person={person}
            onClose={() => setRemoving(null)}
          />
        )}
      </Show>
    </>
  );
}

function PeopleAccessRow(props: {
  readonly spaceId: string;
  readonly entry: SpaceUserEntry;
  readonly isHost: boolean;
  readonly canManage: boolean;
  readonly onRemove: () => void;
}): JSX.Element {
  return (
    <Show
      when={props.isHost}
      fallback={
        <Show
          when={props.canManage}
          fallback={
            <SpaceShareUserRow userId={props.entry.userId} trailing={null} />
          }
        >
          <RemovablePeopleRow
            spaceId={props.spaceId}
            userId={props.entry.userId}
            onRemove={props.onRemove}
          />
        </Show>
      }
    >
      <SpaceShareUserRow
        userId={props.entry.userId}
        trailing={<HostBadge size="sm" />}
      />
    </Show>
  );
}

function RemovablePeopleRow(props: {
  readonly spaceId: string;
  readonly userId: string;
  readonly onRemove: () => void;
}): JSX.Element {
  return (
    <SpaceShareUserRow
      userId={props.userId}
      trailing={
        <Button
          onClick={props.onRemove}
          size="sm"
          dataSet={{ testid: Handles.spaceRemovePerson(props.userId) }}
          title={<Trans>Remove</Trans>}
        />
      }
    />
  );
}
