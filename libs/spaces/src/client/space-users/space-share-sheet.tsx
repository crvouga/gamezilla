import { UserProfileAvatar } from '@libs/profile/client/user-profile-avatar';
import { UserUsername } from '@libs/profile/client/user-username';
import {
  useDebouncedUserSearchEffect,
  UserSearchQueryHint,
  UserSearchSignInPrompt,
} from '@libs/user-search/client/use-user-search';
import { useCurrentSpaceRole } from '../use-current-space-role';
import {
  Box,
  Button,
  EmptyState,
  LoadingState,
  ResponsiveSurface,
  ScrollView,
  Text,
  TextInput,
  useMutationButton,
} from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Platform, Share } from 'react-native';

import { useAddSpaceUser, useRemoveSpaceUser } from './use-space-users';
import {
  useSpaceUserEntries,
  type SpaceUserEntry,
} from './use-space-user-entries';

export type SpaceShareSheetProps = {
  readonly spaceId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

type SearchProfile = {
  readonly userId: string;
};

function spaceShareUrl(spaceId: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/space/${spaceId}`;
  }
  return `/space/${spaceId}`;
}

function SpaceUserRow({
  userId,
  trailing,
}: {
  readonly userId: string;
  readonly trailing: ReactNode;
}): ReactNode {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        py: 2,
      }}
    >
      <UserProfileAvatar profileId={userId} size={44} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <UserUsername profileId={userId} variant="bodyBold" numberOfLines={1} />
      </Box>
      {trailing}
    </Box>
  );
}

function ListedUserRow({
  spaceId,
  entry,
}: {
  readonly spaceId: string;
  readonly entry: SpaceUserEntry;
}): ReactNode {
  const { t } = useLingui();
  const remove = useRemoveSpaceUser();
  const removeButton = useMutationButton({
    operation: useCallback(
      () => remove(spaceId, entry.userId),
      [remove, spaceId, entry.userId]
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
    <SpaceUserRow
      userId={entry.userId}
      trailing={<Button {...removeButton.buttonProps} size="sm" />}
    />
  );
}

function SearchAddRow({
  spaceId,
  profile,
  alreadyListed,
}: {
  readonly spaceId: string;
  readonly profile: SearchProfile;
  readonly alreadyListed: boolean;
}): ReactNode {
  const { t } = useLingui();
  const add = useAddSpaceUser();
  const addButton = useMutationButton({
    operation: useCallback(
      () => add(spaceId, profile.userId),
      [add, spaceId, profile.userId]
    ),
    labels: {
      idle: alreadyListed ? t`Added` : t`Add`,
      loading: t`Adding…`,
      success: t`Added`,
      error: t`Couldn't add`,
    },
    disabled: alreadyListed,
    successHoldMs: 0,
  });
  return (
    <SpaceUserRow
      userId={profile.userId}
      trailing={<Button {...addButton.buttonProps} size="sm" />}
    />
  );
}

function ShareLinkSection({
  spaceId,
}: {
  readonly spaceId: string;
}): ReactNode {
  const { t } = useLingui();
  const copyLink = useCallback(async () => {
    const url = spaceShareUrl(spaceId);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      await navigator.clipboard.writeText(url);
      return;
    }
    await Share.share({ message: url, url });
  }, [spaceId]);
  const copyButton = useMutationButton({
    operation: copyLink,
    labels: {
      idle: t`Copy link`,
      loading: t`Copying…`,
      success: t`Copied`,
      error: t`Couldn't copy`,
    },
  });
  return (
    <Box sx={{ gap: 2 }}>
      <Text variant="label" label={<Trans>Link</Trans>} />
      <Button {...copyButton.buttonProps} />
    </Box>
  );
}

function HostSpaceUsersSection({
  spaceId,
}: {
  readonly spaceId: string;
}): ReactNode {
  const { t } = useLingui();
  const { entries, isLoading } = useSpaceUserEntries(spaceId);
  const listedIds = useMemo(
    () => new Set(entries.map((e) => e.userId)),
    [entries]
  );
  const [query, setQuery] = useState('');
  const { results, searching, signedIn } = useDebouncedUserSearchEffect(query);

  return (
    <Box sx={{ gap: 2 }}>
      <Text variant="label" label={<Trans>People</Trans>} />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={<Trans>Private spaces only sync for people you add here.</Trans>}
      />
      {!signedIn ? <UserSearchSignInPrompt /> : null}
      {signedIn ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t`Search by username`}
          autoCapitalize="none"
          autoCorrect={false}
        />
      ) : null}
      <UserSearchQueryHint query={query} signedIn={signedIn} />
      {searching ? <LoadingState size="small" /> : null}
      {results.map((profile) => (
        <SearchAddRow
          key={profile.userId}
          spaceId={spaceId}
          profile={profile}
          alreadyListed={listedIds.has(profile.userId)}
        />
      ))}
      {isLoading ? <LoadingState size="small" /> : null}
      {!isLoading && entries.length === 0 ? (
        <EmptyState variant="compact" title={<Trans>No one added yet</Trans>} />
      ) : null}
      {entries.map((entry) => (
        <ListedUserRow key={entry.userId} spaceId={spaceId} entry={entry} />
      ))}
    </Box>
  );
}

export function SpaceShareSheet({
  spaceId,
  open,
  onOpenChange,
}: SpaceShareSheetProps): ReactNode {
  const role = useCurrentSpaceRole(spaceId);
  const isHost = role === 'host';

  return (
    <ResponsiveSurface
      visible={open}
      onClose={() => onOpenChange(false)}
      title={<Trans>Share space</Trans>}
      size="medium"
    >
      <ScrollView style={{ maxHeight: 480 }} sx={{ px: 0, gap: 3 }}>
        <ShareLinkSection spaceId={spaceId} />
        {isHost ? <HostSpaceUsersSection spaceId={spaceId} /> : null}
      </ScrollView>
    </ResponsiveSurface>
  );
}
