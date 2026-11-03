import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import { usernameText } from '@libs/moderation-shared-ts/display';
import { useProfileColumn } from '@libs/profile-client-ts/use-profile-column';
import { type Accessor, createMemo, mapArray } from 'solid-js';
import type { SpacePerson } from './space-person-view';

/**
 * One person as a {@link SpacePerson}, read from their synced profile and
 * shown as the moderation policy allows. Null while there is no id.
 */
export function useSpacePerson(
  profileId: Accessor<string | null>
): Accessor<SpacePerson | null> {
  const id = (): string => profileId() ?? '';
  const username = useProfileColumn(id, 'username');
  const avatarConfig = useProfileColumn(id, 'avatarConfig');
  const kind = useProfileColumn(id, 'accountKind');
  const moderation = useModeration();
  return createMemo(() => {
    const current = profileId();
    if (current === null || current.length === 0) return null;
    return {
      id: current,
      name: usernameText(moderation(), username(), current),
      avatarConfig: avatarConfig(),
      bot: kind() === 'synthetic',
    };
  });
}

/** {@link useSpacePerson} for each id, in order; unknown ids are dropped. */
export function useSpacePeople(
  profileIds: Accessor<readonly string[]>
): Accessor<readonly SpacePerson[]> {
  const people = mapArray(profileIds, (id) => useSpacePerson(() => id));
  return createMemo(() =>
    people()
      .map((person) => person())
      .filter((person): person is SpacePerson => person !== null)
  );
}
