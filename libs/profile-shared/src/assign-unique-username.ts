import sql from '@pkgs/sql-root-shared/sql';
import type { MutationDb } from '@pkgs/sync-engine-shared/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';

import { generateRandomUsername } from './username-generator';

const MAX_USERNAME_ASSIGN_ATTEMPTS = 8;

/**
 * Probe-then-update so we avoid unique-violation aborts inside the mutation
 * transaction (Postgres poisons the whole txn on 23505).
 */
export async function assignUniqueUsernameIfEmpty(
  tx: MutationDb,
  profileId: string
): Promise<void> {
  const current = await tx.query(sql<{ username: string | null }>`
    SELECT username
    FROM profile
    WHERE id = ${profileId}
    LIMIT 1
  `);
  const existing = current[0]?.username;
  if (typeof existing === 'string' && existing.length > 0) {
    return;
  }

  for (let attempt = 0; attempt < MAX_USERNAME_ASSIGN_ATTEMPTS; attempt += 1) {
    const username = generateRandomUsername(`${profileId}:${attempt}`);
    const taken = await tx.query(sql<{ one: number }>`
      SELECT 1 AS one
      FROM profile
      WHERE lower(username) = ${username.toLowerCase()}
        AND username <> ''
      LIMIT 1
    `);
    if (taken.length > 0) continue;

    await tx.run(sql`
      UPDATE profile
      SET username = ${username}, username_norm = ${username.toLowerCase()}
      WHERE id = ${profileId}
        AND (username = '' OR username IS NULL)
    `);

    const after = await tx.query(sql<{ username: string | null }>`
      SELECT username
      FROM profile
      WHERE id = ${profileId}
      LIMIT 1
    `);
    const assigned = after[0]?.username;
    if (typeof assigned === 'string' && assigned.length > 0) {
      return;
    }
  }

  throw new MutationError(
    'USERNAME_TAKEN',
    'Could not assign a unique username.'
  );
}
