import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import { usernameText } from '@libs/moderation-shared-ts/display';
import { useKnownUserProfiles } from '@libs/user-search-client-ts/use-known-user-profiles';
import {
  UserSearchDenied,
  useDebouncedUserSearchEffect,
} from '@libs/user-search-client-ts/use-user-search';
import { createAsync } from '@pkgs/async-root-client-ts/solid';
import { usePendingOperation } from '@pkgs/ui-root-client-ts/pending-navigation';
import type { JSX } from 'solid-js';
import { createMemo, createSignal, Show } from 'solid-js';
import type {
  SpaceAddCandidate,
  SpaceAddition,
} from './space-share-add-people-view';
import { SpaceShareAddPeopleView } from './space-share-add-people-view';
import { useAddSpaceUser } from './use-add-space-user';

type FoundProfile = {
  readonly userId: string;
  readonly username: string;
  readonly avatarConfig?: string | null | undefined;
};

/** Wires {@link SpaceShareAddPeopleView} to people search and adding. */
export function SpaceShareAddPeople(props: {
  readonly spaceId: string;
  readonly listedIds: ReadonlySet<string>;
}): JSX.Element {
  const add = useAddSpaceUser();
  const [query, setQuery] = createSignal('');
  const search = useDebouncedUserSearchEffect(query);
  const known = useKnownUserProfiles(query);
  const moderation = useModeration();
  const [lastPick, setLastPick] = createSignal<SpaceAddCandidate | null>(null);
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

  const candidates = createMemo((): readonly SpaceAddCandidate[] =>
    [
      ...new Map(
        [...known(), ...search.results].map((profile: FoundProfile) => [
          profile.userId,
          profile,
        ])
      ).values(),
    ]
      .filter((profile) => !props.listedIds.has(profile.userId))
      .map((profile) => ({
        id: profile.userId,
        name: usernameText(moderation(), profile.username, profile.userId),
        avatarConfig: profile.avatarConfig ?? null,
        bot: false,
        searchText: profile.username,
      }))
  );

  const state = createMemo((): SpaceAddition => {
    const error = addition.error();
    if (error !== null) return { status: 'error', message: error.message };
    if (addition.loading()) return { status: 'loading' };
    const name = addition.value();
    if (addition.status() === 'success' && name !== null)
      return { status: 'success', name };
    return { status: 'idle' };
  });

  const run = (person: SpaceAddCandidate): void => {
    void addition.run(person.id, person.name).catch(() => undefined);
  };

  return (
    <SpaceShareAddPeopleView
      query={query()}
      onQueryChange={setQuery}
      candidates={candidates()}
      searching={search.searching}
      addition={state()}
      searchDenied={
        <Show when={!search.canSearch}>
          <UserSearchDenied />
        </Show>
      }
      onPick={(person) => {
        setLastPick(person);
        run(person);
      }}
      onRetry={() => {
        const pick = lastPick();
        if (pick !== null) run(pick);
      }}
    />
  );
}
