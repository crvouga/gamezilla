import { useMyId } from '@libs/auth-client/use-current-user';
import { useModeration } from '@libs/moderation-client/moderation-context';
import { displayUsername } from '@libs/moderation-shared/display';
import type { UserSearchResult } from '@libs/user-search-shared/user-search-types';
import sql from '@pkgs/sql-root-shared/sql';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

/** People already on this device; discovering new people still uses search. */
export function useKnownUserProfiles(
  query: Accessor<string>
): Accessor<readonly UserSearchResult[]> {
  const myId = useMyId();
  const moderation = useModeration();
  const known = createQuery(
    () => sql<{
      readonly id: string;
      readonly username: string;
      readonly avatar_config: string | null;
    }>`
    SELECT p.id, p.username, p.avatar_config FROM profile AS p
    WHERE p.id <> ${myId()} AND p.deleted_at IS NULL
      AND p.username_norm <> ''
      AND NOT EXISTS (
        SELECT 1 FROM friends_blocks AS b
        WHERE b.deleted_at IS NULL AND b.blocker_id = p.id AND b.blocked_id = ${myId()}
      )
    ORDER BY p.username_norm ASC
  `
  );
  return createMemo(() =>
    known
      .rows()
      .filter((row) =>
        row.username.toLowerCase().startsWith(query().trim().toLowerCase())
      )
      .filter(
        (row) => !displayUsername(moderation(), row.username, row.id).masked
      )
      .map((row) => ({
        userId: row.id,
        username: row.username,
        avatarConfig: row.avatar_config,
      }))
  );
}
