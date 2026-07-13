import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  ProfileError,
  profileErrorFromValidation,
} from '../shared/profile-errors';
import type { ProfileCard } from '../shared/profile-card';
import {
  canChangeUsername,
  normalizeUsername,
  validateUsername,
} from '../shared/username';
import { readProfileCardById } from './read-profile';

function isUniqueViolation(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  if (code === '23505') return true;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('profiles_username_norm_uidx') ||
    message.toLowerCase().includes('unique')
  );
}

type UsernameRow = {
  readonly username: string | null;
  readonly username_changed_at: string | null;
};

async function readUsernameRow(
  sql: SqlClient,
  profileId: string
): Promise<UsernameRow> {
  const rows = await sql.query<UsernameRow>(
    `SELECT ${ProfileCol.username} AS username,
            ${ProfileCol.usernameChangedAt} AS username_changed_at
     FROM ${PROFILES_TABLE.tableName}
     WHERE ${ProfileCol.id} = ?
     LIMIT 1`,
    [profileId]
  );
  const row = rows[0];
  if (row === undefined) {
    throw new ProfileError('PROFILE_NOT_FOUND', 'profile not found');
  }
  return row;
}

async function requireProfileCard(
  sql: SqlClient,
  profileId: string
): Promise<ProfileCard> {
  const card = await readProfileCardById(sql, profileId);
  if (card === null) {
    throw new ProfileError('PROFILE_NOT_FOUND', 'profile not found');
  }
  return card;
}

async function updateUsername(
  sql: SqlClient,
  profileId: string,
  username: string
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await sql.run(
      `UPDATE ${PROFILES_TABLE.tableName}
       SET ${ProfileCol.username} = ?,
           ${ProfileCol.usernameChangedAt} = ?
       WHERE ${ProfileCol.id} = ?`,
      [username, now, profileId]
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ProfileError('PROFILE_USERNAME_TAKEN', 'username is taken');
    }
    throw error;
  }
}

/**
 * Sets the caller's username via the online write path. Enforces format,
 * global uniqueness, and the change cooldown.
 */
export async function setProfileUsername(
  sql: SqlClient,
  profileId: string,
  rawUsername: string
): Promise<ProfileCard> {
  const username = normalizeUsername(rawUsername);
  const validationError = validateUsername(username);
  if (validationError !== null) {
    throw profileErrorFromValidation(validationError);
  }

  const row = await readUsernameRow(sql, profileId);
  const current = typeof row.username === 'string' ? row.username : '';
  if (current === username) {
    return requireProfileCard(sql, profileId);
  }
  if (!canChangeUsername(row.username_changed_at)) {
    throw new ProfileError(
      'PROFILE_USERNAME_COOLDOWN',
      'username change cooldown'
    );
  }

  await updateUsername(sql, profileId, username);
  return requireProfileCard(sql, profileId);
}
