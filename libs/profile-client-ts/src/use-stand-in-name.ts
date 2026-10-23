import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import { displayUsername } from '@libs/moderation-shared-ts/display';
import type { ProfileRow } from '@libs/profile-shared-ts/profile-row-sql';
import { type Accessor, createMemo } from 'solid-js';

/**
 * The stand-in name everyone sees for `row`'s person while their username is
 * no longer allowed, or `null` while it is allowed (or there is no row).
 */
export function useStandInName(
  row: Accessor<ProfileRow | null>
): Accessor<string | null> {
  const moderation = useModeration();
  return createMemo(() => {
    const current = row();
    if (current === null) return null;
    const shown = displayUsername(moderation(), current.username, current.id);
    return shown.masked ? shown.text : null;
  });
}
