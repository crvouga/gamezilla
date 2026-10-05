import { usernameText } from '@libs/moderation-shared/display';
import sql from '@pkgs/sql-root-shared/sql';

import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

export type SpaceUserEntry = {
  readonly userId: string;
  /** Username as others may see it (moderated; masked names are aliases). */
  readonly username: string;
  readonly avatarConfig: string | null;
};

type SpaceUserRow = {
  readonly user_id: string;
  readonly username: string | null;
  readonly avatar_config: string | null;
};

export function useSpaceUserEntries(spaceId: string): {
  readonly entries: Accessor<readonly SpaceUserEntry[]>;
  readonly isLoading: Accessor<boolean>;
} {
  const query = createQuery(
    () => sql<SpaceUserRow>`
      SELECT a.user_id, p.username, p.avatar_config
      FROM spaces_users AS a
      INNER JOIN profile AS p ON p.id = a.user_id
      WHERE a.space_id = ${spaceId} AND a.deleted_at IS NULL
      ORDER BY p.username COLLATE NOCASE ASC
    `
  );
  const entries = createMemo(() =>
    query.rows().map((row) => ({
      userId: row.user_id,
      username: usernameText(row.username, row.user_id),
      avatarConfig: row.avatar_config,
    }))
  );
  return { entries, isLoading: query.isLoading };
}
