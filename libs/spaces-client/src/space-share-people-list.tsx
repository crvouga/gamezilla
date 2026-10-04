import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-client/button';
import { EmptyState } from '@pkgs/ui-client/empty-state';
import { LoadingState } from '@pkgs/ui-client/loading-state';
import { useMutationButton } from '@pkgs/ui-client/use-mutation-button';
import type { JSX } from 'solid-js';
import { createMemo, For, Show } from 'solid-js';

import { useSpaceHostMembershipDisplay } from './use-space-host-membership-display';
import { SpaceShareUserRow } from './space-share-user-row';
import type { SpaceUserEntry } from './use-space-user-entries';
import { useSpaceUserEntries } from './use-space-user-entries';
import { useRemoveSpaceUser } from './use-remove-space-user';

export function SpaceSharePeopleList(props: {
  readonly spaceId: string;
  readonly canManage: boolean;
}): JSX.Element {
  const { entries, isLoading } = useSpaceUserEntries(props.spaceId);
  const host = useSpaceHostMembershipDisplay(props.spaceId);
  const hostProfileId = createMemo(() => host()?.profileId ?? null);

  return (
    <div class="box gap-2">
      <label class="text textLabel">{<Trans>People with access</Trans>}</label>
      <p class="text textCaption text-text-secondary">
        {<Trans>Private spaces only sync for people you add here.</Trans>}
      </p>
      <Show when={isLoading()}>
        <LoadingState size="small" />
      </Show>
      <Show when={!isLoading() && entries().length === 0}>
        <EmptyState variant="compact" title={<Trans>No one added yet</Trans>} />
      </Show>
      <For each={entries()}>
        {(entry) => (
          <PeopleAccessRow
            spaceId={props.spaceId}
            entry={entry}
            isHost={hostProfileId() === entry.userId}
            canManage={props.canManage}
          />
        )}
      </For>
    </div>
  );
}

function PeopleAccessRow(props: {
  readonly spaceId: string;
  readonly entry: SpaceUserEntry;
  readonly isHost: boolean;
  readonly canManage: boolean;
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
}): JSX.Element {
  const { t } = useLingui();
  const remove = useRemoveSpaceUser();
  const removeButton = useMutationButton({
    operation: () => remove(props.spaceId, props.userId),
    labels: {
      idle: t`Remove`,
      loading: t`Removing…`,
      success: t`Removed`,
      error: t`Couldn't remove`,
    },
    successHoldMs: 0,
  });
  return (
    <SpaceShareUserRow
      userId={props.userId}
      trailing={<Button {...removeButton.buttonProps} size="sm" />}
    />
  );
}
