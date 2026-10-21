import { useModeration } from '@libs/moderation-client/moderation-context';
import { usernameText } from '@libs/moderation-shared/display';
import { UserProfileAvatar } from '@libs/profile-client/user-profile-avatar';
import { Handles } from '@libs/test-ids-shared/handles';
import { useKnownUserProfiles } from '@libs/user-search-client/use-known-user-profiles';
import {
  UserSearchDenied,
  useDebouncedUserSearchEffect,
} from '@libs/user-search-client/use-user-search';
import { Trans, useLingui } from '@lingui/solid/macro';
import { createAsync } from '@pkgs/async-root-client/solid';
import { Combobox } from '@pkgs/ui-root-client/combobox';
import { usePendingOperation } from '@pkgs/ui-root-client/pending-navigation';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import type { ComboboxOption } from '@pkgs/ui-root-shared/combobox-types';
import type { JSX } from 'solid-js';
import { createMemo, createSignal, Show } from 'solid-js';
import { SpaceAdditionState } from './space-addition-state';
import { useAddSpaceUser } from './use-add-space-user';

export function SpaceShareAddPeople(props: {
  readonly spaceId: string;
  readonly listedIds: ReadonlySet<string>;
}): JSX.Element {
  const { t } = useLingui();
  const add = useAddSpaceUser();
  const [query, setQuery] = createSignal('');
  const search = useDebouncedUserSearchEffect(query);
  const known = useKnownUserProfiles(query);
  const moderation = useModeration();
  const [lastPick, setLastPick] = createSignal<{
    id: string;
    name: string;
  } | null>(null);
  const addition = createAsync({
    operation: async (_context, id: string, name: string) => {
      await add(props.spaceId, id);
      setQuery('');
      return name;
    },
  });
  usePendingOperation(addition.loading, () =>
    addition.cancelAll('Leaving while adding a person')
  );

  const options = createMemo((): ComboboxOption[] =>
    [
      ...new Map(
        [...known(), ...search.results].map((profile) => [
          profile.userId,
          profile,
        ])
      ).values(),
    ]
      .filter((profile) => !props.listedIds.has(profile.userId))
      .map((profile) => ({
        value: profile.userId,
        label: usernameText(moderation(), profile.username, profile.userId),
        // Search matches what was typed against the stored handle.
        searchText: profile.username,
        dataSet: { testid: Handles.spaceAddPerson(profile.userId) },
        preview: <UserProfileAvatar profileId={profile.userId} size={32} />,
      }))
  );

  const handlePick = (userId: string): void => {
    const profile = [...known(), ...search.results].find(
      (person) => person.userId === userId
    );
    if (profile === undefined) return;
    const name = usernameText(moderation(), profile.username, profile.userId);
    setLastPick({ id: userId, name });
    void addition.run(userId, name).catch(() => undefined);
  };

  const emptyMessage = createMemo(() => {
    const trimmed = query().trim();
    if (trimmed.length > 0 && !search.searching) {
      return <Trans>No people found</Trans>;
    }
    return undefined;
  });

  return (
    <StackVertical gap="sm">
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
        loading={search.searching && options().length === 0}
        disabled={addition.loading()}
        emptyMessage={emptyMessage()}
        triggerDataSet={{ testid: Handles.spaceAddTrigger }}
        searchDataSet={{ testid: Handles.spaceAddQuery }}
      />
      <Show when={!search.canSearch}>
        <UserSearchDenied />
      </Show>
      <SpaceAdditionState addition={addition} lastPick={lastPick} />
    </StackVertical>
  );
}
