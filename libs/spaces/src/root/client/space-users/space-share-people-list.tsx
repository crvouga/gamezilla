import { Trans, useLingui } from '@lingui/solid/macro';
import {
  Box,
  Button,
  EmptyState,
  LoadingState,
  Text,
  useMutationButton,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createMemo, For, Show } from 'solid-js';

import { useSpaceHostMembershipDisplay } from '../members/use-space-host-membership-display';
import { SpaceShareUserRow } from './space-share-user-row';
import {
  type SpaceUserEntry,
  useSpaceUserEntries,
} from './use-space-user-entries';
import { useRemoveSpaceUser } from './use-space-users';

export function SpaceSharePeopleList(props: {
  readonly spaceId: string;
  readonly canManage: boolean;
}): JSX.Element {
  const { entries, isLoading } = useSpaceUserEntries(props.spaceId);
  const host = useSpaceHostMembershipDisplay(props.spaceId);
  const hostProfileId = createMemo(() => host()?.profileId ?? null);

  return (
    <Box sx={{ gap: 2 }}>
      <Text variant="label" label={<Trans>People with access</Trans>} />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={<Trans>Private spaces only sync for people you add here.</Trans>}
      />
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
    </Box>
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
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={<Trans>Host</Trans>}
          />
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
