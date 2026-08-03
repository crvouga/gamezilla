import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  parseAvatarConfig,
  serializeDefaultAvatarConfig,
} from '../avatar-config';

export type EnsureProfileLocalInput = {
  readonly profileId: string;
  /** When set, fill an empty local username (from POST /profile/ensure). */
  readonly username?: string;
};

type ProfileRow = Record<string, unknown>;

function profileLooksPresent(
  row: ProfileRow | undefined,
  expectedId: string
): boolean {
  if (row === undefined) return false;
  return row['id'] === expectedId && typeof row['created_at'] === 'string';
}

function hasAvatarConfig(row: ProfileRow | undefined): boolean {
  if (row === undefined) return false;
  return parseAvatarConfig(row['avatar_config']) !== null;
}

async function backfillAvatar(db: SqlClient, profileId: string): Promise<void> {
  await db.run(sql`
    UPDATE profiles
    SET avatar_config = ${serializeDefaultAvatarConfig(profileId)}
    WHERE id = ${profileId}
  `);
}

async function insertProfileSeed(
  db: SqlClient,
  profileId: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.run(sql`
    INSERT INTO profiles (id, created_at, username, avatar_config)
    VALUES (
      ${profileId},
      ${now},
      '',
      ${serializeDefaultAvatarConfig(profileId)}
    )
  `);
}

async function fillEmptyUsername(
  db: SqlClient,
  profileId: string,
  username: string
): Promise<void> {
  // Fill empty, or replace an auto-assigned name that does not match ensure
  // (e.g. a raced apply from another account's token). Never overwrite a
  // user-chosen username (`username_changed_at` set).
  await db.run(sql`
    UPDATE profiles
    SET username = ${username}
    WHERE id = ${profileId}
      AND (
        username = ''
        OR username IS NULL
        OR (
          (username_changed_at IS NULL OR username_changed_at = '')
          AND username != ${username}
        )
      )
  `);
}

/**
 * Seeds / backfills the local `profiles` row for `myId`. Username assignment
 * stays online via `POST /profile/ensure`; pass `username` to apply that
 * result locally when the row is still empty (avoids waiting on sync).
 * Username UPDATEs may enqueue PowerSync PATCHes — upload strips those
 * server-owned columns (`stripServerOwnedProfileUploadColumns`) so they
 * do not apply (or assert) on `/api/sync/upload`.
 */
export async function ensureProfileLocal(
  db: SqlClient,
  input: EnsureProfileLocalInput
): Promise<void> {
  const rows = await db.query<ProfileRow>(sql`
    SELECT *
    FROM profiles
    WHERE id = ${input.profileId}
    LIMIT 1
  `);
  const existing = rows[0];
  if (profileLooksPresent(existing, input.profileId)) {
    if (!hasAvatarConfig(existing)) {
      await backfillAvatar(db, input.profileId);
    }
    if (input.username !== undefined) {
      await fillEmptyUsername(db, input.profileId, input.username);
    }
    return;
  }
  await insertProfileSeed(db, input.profileId);
  if (input.username !== undefined) {
    await fillEmptyUsername(db, input.profileId, input.username);
  }
}
