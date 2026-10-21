import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
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
      <div class="box gap-2">
        <label class="text textLabel">
          {<Trans>People with access</Trans>}
        </label>
        <p class="text textCaption text-text-secondary">
          {
            <Trans>
              Added people find this space in their lobby and choose Join.
              Anyone with the space link can also join.
            </Trans>
          }
        </p>
        <Show when={isLoading()}>
          <LoadingState size="sm" />
        </Show>
        <Show when={!isLoading() && entries().length === 0}>
          <EmptyState
            variant="compact"
            title={<Trans>No one added yet</Trans>}
          />
        </Show>
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
      </div>
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
        trailing={
          <p class="text textCaption text-text-secondary">
            {<Trans>Host</Trans>}
          </p>
        }
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
