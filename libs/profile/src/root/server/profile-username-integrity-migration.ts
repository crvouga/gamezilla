import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { sql } from '@pkgs/sql';
import { containsBlockedTerm } from '@pkgs/word-filter';

import { generateRandomUsername } from '../../shared/profile/username-generator';

type ProfileRow = {
  readonly id: string;
  readonly username: string | null;
  readonly username_norm: string | null;
  readonly created_at: string | null;
};

const MAX_REASSIGN_ATTEMPTS = 64;

function assignableUsername(args: {
  readonly profileId: string;
  readonly taken: ReadonlySet<string>;
}): string | null {
  for (let i = 0; i < MAX_REASSIGN_ATTEMPTS; i += 1) {
    const candidate = generateRandomUsername(
      `${args.profileId}:integrity:${String(i)}`
    );
    if (
      !args.taken.has(candidate.toLowerCase()) &&
      !containsBlockedTerm(candidate)
    ) {
      return candidate;
    }
  }
  return null;
}

/**
 * Runs before the unique index on `profile.username_norm` is created:
 * clears empty norms, resolves duplicate usernames (oldest row wins), and
 * renames usernames the content filter refuses. A database without a `profile`
 * table yet (fresh install / harness seed) is skipped.
 */
export class ProfileUsernameIntegrityMigration implements DatabaseMigration {
  private async readProfiles(
    ctx: DatabaseMigrationContext
  ): Promise<readonly ProfileRow[] | null> {
    // Probe instead of catching `undefined_table`: the runner holds one
    // transaction, and a failed statement aborts it for every later migration.
    const exists = await ctx.sqlClient.query(sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'profile'
      ) AS exists
    `);
    if (exists[0]?.exists !== true) return null;
    return await ctx.sqlClient.query<ProfileRow>(sql`
      SELECT id, username, username_norm, created_at
      FROM profile
      ORDER BY created_at ASC, id ASC
    `);
  }

  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    const rows = await this.readProfiles(ctx);
    if (rows === null) {
      ctx.logger.info(
        'profile username integrity: profile table absent, nothing to repair'
      );
      return;
    }

    const taken = new Set<string>();
    const updates: { id: string; username: string; norm: string | null }[] = [];

    for (const row of rows) {
      const username = row.username ?? '';
      const norm = username.length > 0 ? username.toLowerCase() : null;
      if (norm === null) {
        if ((row.username_norm ?? '') !== '') {
          updates.push({ id: row.id, username, norm: null });
        }
        continue;
      }
      if (taken.has(norm) || containsBlockedTerm(username)) {
        const assignable = assignableUsername({ profileId: row.id, taken });
        if (assignable === null) {
          throw new Error(
            `profile username integrity: no assignable username for ${row.id}`
          );
        }
        taken.add(assignable.toLowerCase());
        updates.push({
          id: row.id,
          username: assignable,
          norm: assignable.toLowerCase(),
        });
        continue;
      }
      taken.add(norm);
      if (row.username_norm !== norm) {
        updates.push({ id: row.id, username, norm });
      }
    }

    for (const update of updates) {
      await ctx.sqlClient.run(sql`
        UPDATE profile
        SET username = ${update.username}, username_norm = ${update.norm}
        WHERE id = ${update.id}
      `);
    }
    ctx.logger.info(
      `profile username integrity: repaired ${String(updates.length)} rows`
    );
  }
}
