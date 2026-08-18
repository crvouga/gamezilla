import { UserProfileAvatar } from '@libs/profile/public/user-profile-avatar';
import {
  UserSearchQueryHint,
  UserSearchSignInPrompt,
  useDebouncedUserSearchEffect,
} from '@libs/user-search/public/use-user-search';
import { USER_SEARCH_MIN_LENGTH } from '@libs/user-search/public/user-search-types';
import { Trans, useLingui } from '@lingui/react/macro';
import { Box, Combobox, type ComboboxOption, Text } from '@pkgs/ui';
import { type ReactNode, useCallback, useMemo, useState } from 'react';

import { useAddSpaceUser } from './use-space-users';

export function SpaceShareAddPeople({
  spaceId,
  listedIds,
}: {
  readonly spaceId: string;
  readonly listedIds: ReadonlySet<string>;
}): ReactNode {
  const { t } = useLingui();
  const add = useAddSpaceUser();
  const [query, setQuery] = useState('');
  const { results, searching, signedIn } = useDebouncedUserSearchEffect(query);

  const options = useMemo((): ComboboxOption[] => {
    return results
      .filter((profile) => !listedIds.has(profile.userId))
      .map((profile) => ({
        value: profile.userId,
        label: profile.username,
        searchText: profile.username,
        preview: <UserProfileAvatar profileId={profile.userId} size={32} />,
      }));
  }, [results, listedIds]);

  const handlePick = useCallback(
    (userId: string) => {
      void add(spaceId, userId).then(() => {
        setQuery('');
      });
    },
    [add, spaceId]
  );

  if (!signedIn) {
    return (
      <Box sx={{ gap: 2 }}>
        <Text variant="label" label={<Trans>Add people</Trans>} />
        <UserSearchSignInPrompt />
      </Box>
    );
  }

  const trimmed = query.trim();
  const emptyMessage =
    trimmed.length > 0 && trimmed.length < USER_SEARCH_MIN_LENGTH ? (
      <Trans>Enter at least {USER_SEARCH_MIN_LENGTH} characters</Trans>
    ) : trimmed.length >= USER_SEARCH_MIN_LENGTH && !searching ? (
      <Trans>No people found</Trans>
    ) : undefined;

  return (
    <Box sx={{ gap: 2 }}>
      <Combobox
        label={<Trans>Add people</Trans>}
        surfaceTitle={<Trans>Add people</Trans>}
        options={options}
        onValueChange={handlePick}
        query={query}
        onQueryChange={setQuery}
        filterOption={() => true}
        placeholder={t`Search by username`}
        searchPlaceholder={t`Search by username`}
        loading={searching}
        emptyMessage={emptyMessage}
      />
      <UserSearchQueryHint query={query} signedIn={signedIn} />
    </Box>
  );
}
