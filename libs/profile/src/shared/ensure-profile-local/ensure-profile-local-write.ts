import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { fail, ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';
import { idMatches } from '@pkgs/write/shared/read-row-values';

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

function parseEnsureProfileLocalInput(
  raw: unknown
): ReturnType<typeof ok<EnsureProfileLocalInput>> | ReturnType<typeof fail> {
  if (raw === null || typeof raw !== 'object') {
    return fail('INVALID_INPUT', 'ensure profile input must be an object');
  }
  const record = raw as Record<string, unknown>;
  const profileId = record['profileId'];
  if (typeof profileId !== 'string' || profileId.length === 0) {
    return fail('INVALID_INPUT', 'profileId is required');
  }
  const username = record['username'];
  return ok({
    profileId,
    ...(typeof username === 'string' && username.length > 0
      ? { username }
      : {}),
  });
}

function profileLooksPresent(
  row: ProfileRow | undefined,
  expectedId: string
): boolean {
  if (row === undefined) return false;
  return (
    row[ProfileCol.id] === expectedId &&
    typeof row[ProfileCol.createdAt] === 'string'
  );
}

function hasAvatarConfig(row: ProfileRow | undefined): boolean {
  if (row === undefined) return false;
  return parseAvatarConfig(row[ProfileCol.avatarConfig]) !== null;
}

async function backfillAvatar(
  sql: SqlClient,
  profileId: string
): Promise<void> {
  await sql.run(
    `UPDATE ${PROFILES_TABLE.tableName}
     SET ${ProfileCol.avatarConfig} = ?
     WHERE ${ProfileCol.id} = ?`,
    [serializeDefaultAvatarConfig(profileId), profileId]
  );
}

async function insertProfileSeed(
  sql: SqlClient,
  profileId: string
): Promise<void> {
  const now = new Date().toISOString();
  await sql.run(
    `INSERT INTO ${PROFILES_TABLE.tableName}
     (${ProfileCol.id}, ${ProfileCol.createdAt}, ${ProfileCol.username}, ${ProfileCol.avatarConfig})
     VALUES (?, ?, ?, ?)`,
    [profileId, now, '', serializeDefaultAvatarConfig(profileId)]
  );
}

async function fillEmptyUsername(
  sql: SqlClient,
  profileId: string,
  username: string
): Promise<void> {
  // Fill empty, or replace an auto-assigned name that does not match ensure
  // (e.g. a raced apply from another account's token). Never overwrite a
  // user-chosen username (`username_changed_at` set).
  await sql.run(
    `UPDATE ${PROFILES_TABLE.tableName}
     SET ${ProfileCol.username} = ?
     WHERE ${ProfileCol.id} = ?
       AND (
         ${ProfileCol.username} = ''
         OR ${ProfileCol.username} IS NULL
         OR (
           (${ProfileCol.usernameChangedAt} IS NULL
             OR ${ProfileCol.usernameChangedAt} = '')
           AND ${ProfileCol.username} != ?
         )
       )`,
    [username, profileId, username]
  );
}

/**
 * Seeds / backfills the local `profiles` row for `myId`. Username assignment
 * stays online via `POST /profile/ensure`; pass `username` to apply that
 * result locally when the row is still empty (avoids waiting on sync).
 */
export const ensureProfileLocalWrite = defineWrite<
  EnsureProfileLocalInput,
  void
>({
  name: 'profile.ensureLocal',
  parseInput: parseEnsureProfileLocalInput,
  authorize: async (ctx, input) => {
    const idError = idMatches(input.profileId, ctx.myId, 'PROFILE_ID_MISMATCH');
    if (idError !== null) return idError;
    return ok(undefined);
  },
  execute: async (_ctx, input, sql) => {
    const rows = await sql.query<ProfileRow>(
      `SELECT * FROM ${PROFILES_TABLE.tableName} WHERE ${ProfileCol.id} = ? LIMIT 1`,
      [input.profileId]
    );
    const existing = rows[0];
    if (profileLooksPresent(existing, input.profileId)) {
      if (!hasAvatarConfig(existing)) {
        await backfillAvatar(sql, input.profileId);
      }
      if (input.username !== undefined) {
        await fillEmptyUsername(sql, input.profileId, input.username);
      }
      return ok(undefined);
    }
    await insertProfileSeed(sql, input.profileId);
    if (input.username !== undefined) {
      await fillEmptyUsername(sql, input.profileId, input.username);
    }
    return ok(undefined);
  },
});
