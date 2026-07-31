import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { sqlMap } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { defineWrite } from '@pkgs/write/shared/define-write';
import { idMatches } from '@pkgs/write/shared/read-row-values';
import { fail, ok } from '@pkgs/write/shared/write-result';

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
  input: unknown
): ReturnType<typeof ok<EnsureProfileLocalInput>> | ReturnType<typeof fail> {
  if (input === null || typeof input !== 'object') {
    return fail('INVALID_INPUT', 'ensure profile input must be an object');
  }
  const record = input as Record<string, unknown>;
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

async function backfillAvatar(db: SqlClient, profileId: string): Promise<void> {
  await db.run(
    sqlMap({
      update: PROFILES_TABLE.tableName,
      set: {
        [ProfileCol.avatarConfig]: serializeDefaultAvatarConfig(profileId),
      },
      where: ['=', ProfileCol.id, profileId],
    })
  );
}

async function insertProfileSeed(
  db: SqlClient,
  profileId: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.run(
    sqlMap({
      insertInto: PROFILES_TABLE.tableName,
      values: {
        [ProfileCol.id]: profileId,
        [ProfileCol.createdAt]: now,
        [ProfileCol.username]: '',
        [ProfileCol.avatarConfig]: serializeDefaultAvatarConfig(profileId),
      },
    })
  );
}

async function fillEmptyUsername(
  db: SqlClient,
  profileId: string,
  username: string
): Promise<void> {
  // Fill empty, or replace an auto-assigned name that does not match ensure
  // (e.g. a raced apply from another account's token). Never overwrite a
  // user-chosen username (`username_changed_at` set).
  await db.run(
    sqlMap({
      update: PROFILES_TABLE.tableName,
      set: { [ProfileCol.username]: username },
      where: [
        'and',
        ['=', ProfileCol.id, profileId],
        [
          'or',
          ['=', ProfileCol.username, ''],
          ['is-null', ProfileCol.username],
          [
            'and',
            [
              'or',
              ['is-null', ProfileCol.usernameChangedAt],
              ['=', ProfileCol.usernameChangedAt, ''],
            ],
            ['!=', ProfileCol.username, username],
          ],
        ],
      ],
    })
  );
}

/**
 * Seeds / backfills the local `profiles` row for `myId`. Username assignment
 * stays online via `POST /profile/ensure`; pass `username` to apply that
 * result locally when the row is still empty (avoids waiting on sync).
 * Username UPDATEs may enqueue PowerSync PATCHes — upload strips those
 * server-owned columns (`stripServerOwnedProfileUploadColumns`) so they
 * do not apply (or assert) on `/api/sync/upload`.
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
  execute: async (_ctx, input, db) => {
    const rows = await db.query<ProfileRow>(
      sqlMap({
        from: PROFILES_TABLE.tableName,
        where: ['=', ProfileCol.id, input.profileId],
        limit: 1,
      })
    );
    const existing = rows[0];
    if (profileLooksPresent(existing, input.profileId)) {
      if (!hasAvatarConfig(existing)) {
        await backfillAvatar(db, input.profileId);
      }
      if (input.username !== undefined) {
        await fillEmptyUsername(db, input.profileId, input.username);
      }
      return ok(undefined);
    }
    await insertProfileSeed(db, input.profileId);
    if (input.username !== undefined) {
      await fillEmptyUsername(db, input.profileId, input.username);
    }
    return ok(undefined);
  },
});
