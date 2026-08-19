import { sql } from '@pkgs/sql';
import type { MutationDb } from '@pkgs/sync-engine/shared';

import { normalizeUsername, validateUsername } from './username';

/**
 * Overwrite a bootstrap (unclaimed) username with the create-account handle.
 * Does not set `username_changed_at`. Invalid or taken names are ignored.
 */
export async function applyPreferredUsernameIfAvailable(
  tx: MutationDb,
  profileId: string,
  rawUsername: string | undefined
): Promise<void> {
  if (rawUsername === undefined) return;
  const username = normalizeUsername(rawUsername).toLowerCase();
  if (validateUsername(username) !== null) return;

  const taken = await tx.query(sql<{ one: number }>`
    SELECT 1 AS one
    FROM profile
    WHERE username_norm = ${username}
      AND id <> ${profileId}
      AND username <> ''
    LIMIT 1
  `);
  if (taken.length > 0) return;

  await tx.run(sql`
    UPDATE profile
    SET username = ${username},
        username_norm = ${username}
    WHERE id = ${profileId}
      AND (
        username_changed_at IS NULL
        OR username_changed_at = ''
      )
  `);
}
