import { Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  Button,
  EmptyState,
  LoadingState,
  Text,
  useMutationButton,
} from '@pkgs/ui-rn';
import { type ReactNode, useCallback } from 'react';

import { useSpaceHostMembershipDisplay } from '../members/use-space-host-membership-display';
import { SpaceShareUserRow } from './space-share-user-row';
import {
  type SpaceUserEntry,
  useSpaceUserEntries,
} from './use-space-user-entries';
import { useRemoveSpaceUser } from './use-space-users';

export function SpaceSharePeopleList({
  spaceId,
  canManage,
}: {
  readonly spaceId: string;
  readonly canManage: boolean;
}): ReactNode {
  const { entries, isLoading } = useSpaceUserEntries(spaceId);
  const host = useSpaceHostMembershipDisplay(spaceId);
  const hostProfileId = host?.profileId ?? null;

  return (
    <Box sx={{ gap: 2 }}>
      <Text variant="label" label={<Trans>People with access</Trans>} />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={<Trans>Private spaces only sync for people you add here.</Trans>}
      />
      {isLoading ? <LoadingState size="small" /> : null}
      {!isLoading && entries.length === 0 ? (
        <EmptyState variant="compact" title={<Trans>No one added yet</Trans>} />
      ) : null}
      {entries.map((entry) => (
        <PeopleAccessRow
          key={entry.userId}
          spaceId={spaceId}
          entry={entry}
          isHost={hostProfileId === entry.userId}
          canManage={canManage}
        />
      ))}
    </Box>
  );
}

function PeopleAccessRow({
  spaceId,
  entry,
  isHost,
  canManage,
}: {
  readonly spaceId: string;
  readonly entry: SpaceUserEntry;
  readonly isHost: boolean;
  readonly canManage: boolean;
}): ReactNode {
  if (isHost) {
    return (
      <SpaceShareUserRow
        userId={entry.userId}
        trailing={
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={<Trans>Host</Trans>}
          />
        }
      />
    );
  }

  if (!canManage) {
    return <SpaceShareUserRow userId={entry.userId} trailing={null} />;
  }

  return <RemovablePeopleRow spaceId={spaceId} userId={entry.userId} />;
}

function RemovablePeopleRow({
  spaceId,
  userId,
}: {
  readonly spaceId: string;
  readonly userId: string;
}): ReactNode {
  const { t } = useLingui();
  const remove = useRemoveSpaceUser();
  const removeButton = useMutationButton({
    operation: useCallback(
      () => remove(spaceId, userId),
      [remove, spaceId, userId]
    ),
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
      userId={userId}
      trailing={<Button {...removeButton.buttonProps} size="sm" />}
    />
  );
}
