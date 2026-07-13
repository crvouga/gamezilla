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
};

type ProfileRow = Record<string, unknown>;

function parseEnsureProfileLocalInput(
  raw: unknown
): ReturnType<typeof ok<EnsureProfileLocalInput>> | ReturnType<typeof fail> {
  if (raw === null || typeof raw !== 'object') {
    return fail('INVALID_INPUT', 'ensure profile input must be an object');
  }
  const profileId = (raw as Record<string, unknown>)['profileId'];
  if (typeof profileId !== 'string' || profileId.length === 0) {
    return fail('INVALID_INPUT', 'profileId is required');
  }
  return ok({ profileId });
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

/**
 * Seeds / backfills the local `profiles` row for `myId`. Username assignment
 * stays online via `POST /profile/ensure`.
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
      return ok(undefined);
    }
    await insertProfileSeed(sql, input.profileId);
    return ok(undefined);
  },
});
