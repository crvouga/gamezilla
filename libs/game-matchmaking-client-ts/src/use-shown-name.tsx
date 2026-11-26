import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import { usernameText } from '@libs/moderation-shared-ts/display';
import { t } from '@lingui/core/macro';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';

/**
 * A person's name as others may see it now, by profile id: their username,
 * or their stand-in name while that username is no longer allowed. A seat
 * still identifies a player while their name syncs. Only a tombstone
 * confirms deletion.
 */
export function useShownName(profileId: () => string): () => string {
  const moderation = useModeration();
  const { rows } = createQuery(
    () => sql<{ username: string | null; deleted_at: string | null }>`
      SELECT CASE WHEN deleted_at IS NULL THEN username END AS username, deleted_at
      FROM profile WHERE id = ${profileId()}`
  );
  return () => {
    const profile = rows()[0];
    if (profile?.deleted_at) return t`Deleted account`;
    return (
      usernameText(moderation(), profile?.username, profileId()) || t`Player`
    );
  };
}
