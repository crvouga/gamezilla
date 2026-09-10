import { UserProfileAvatar } from '@libs/profile/public/user-profile-avatar';
import {
  UserSearchQueryHint,
  UserSearchSignInPrompt,
  useDebouncedUserSearchEffect,
} from '@libs/user-search/public/use-user-search';
import { USER_SEARCH_MIN_LENGTH } from '@libs/user-search/public/user-search-types';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Combobox, type ComboboxOption } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createMemo, createSignal, Show } from 'solid-js';

import { useAddSpaceUser } from './use-space-users';

export function SpaceShareAddPeople(props: {
  readonly spaceId: string;
  readonly listedIds: ReadonlySet<string>;
}): JSX.Element {
  const { t } = useLingui();
  const add = useAddSpaceUser();
  const [query, setQuery] = createSignal('');
  const search = useDebouncedUserSearchEffect(query);

  const options = createMemo((): ComboboxOption[] =>
    search.results
      .filter((profile) => !props.listedIds.has(profile.userId))
      .map((profile) => ({
        value: profile.userId,
        label: profile.username,
        searchText: profile.username,
        preview: <UserProfileAvatar profileId={profile.userId} size={32} />,
      }))
  );

  const handlePick = (userId: string): void => {
    void add(props.spaceId, userId).then(() => {
      setQuery('');
    });
  };

  const emptyMessage = createMemo(() => {
    const trimmed = query().trim();
    if (trimmed.length > 0 && trimmed.length < USER_SEARCH_MIN_LENGTH) {
      return <Trans>Enter at least {USER_SEARCH_MIN_LENGTH} characters</Trans>;
    }
    if (trimmed.length >= USER_SEARCH_MIN_LENGTH && !search.searching) {
      return <Trans>No people found</Trans>;
    }
    return undefined;
  });

  return (
    <Show
      when={search.signedIn}
      fallback={
        <div class="box gap-2">
          <label class="text textLabel">{<Trans>Add people</Trans>}</label>
          <UserSearchSignInPrompt />
        </div>
      }
    >
      <div class="box gap-2">
        <Combobox
          label={<Trans>Add people</Trans>}
          surfaceTitle={<Trans>Add people</Trans>}
          options={options()}
          onValueChange={handlePick}
          query={query()}
          onQueryChange={setQuery}
          filterOption={() => true}
          placeholder={t`Search by username`}
          searchPlaceholder={t`Search by username`}
          loading={search.searching}
          emptyMessage={emptyMessage()}
        />
        <UserSearchQueryHint query={query()} signedIn={search.signedIn} />
      </div>
    </Show>
  );
}
