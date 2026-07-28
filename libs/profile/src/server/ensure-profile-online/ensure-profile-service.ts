import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { raw, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { serializeDefaultAvatarConfig } from '../../shared/avatar-config';
import { generateRandomUsername } from '../../shared/username-generator';
import { ProfileError } from '../../shared/profile-errors';
import type { ProfileCard } from '../../shared/profile-card';
import { readProfileCardById } from '../read-profile';

const MAX_USERNAME_ASSIGN_ATTEMPTS = 8;

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

async function insertProfileRow(
  db: SqlClient,
  profileId: string,
  username: string,
  now: string
): Promise<void> {
  await db.run(sql`
    INSERT INTO ${raw(PROFILES_TABLE.tableName)}
    (${raw(ProfileCol.id)}, ${raw(ProfileCol.createdAt)}, ${raw(ProfileCol.username)}, ${raw(ProfileCol.avatarConfig)})
    VALUES (${profileId}, ${now}, ${username}, ${serializeDefaultAvatarConfig(profileId)})
    ON CONFLICT (${raw(ProfileCol.id)}) DO NOTHING
  `);
}

async function assignUniqueUsername(
  db: SqlClient,
  profileId: string
): Promise<string> {
  for (let attempt = 0; attempt < MAX_USERNAME_ASSIGN_ATTEMPTS; attempt += 1) {
    const username = generateRandomUsername(`${profileId}:${attempt}`);
    try {
      await db.run(sql`
        UPDATE ${raw(PROFILES_TABLE.tableName)}
        SET ${raw(ProfileCol.username)} = ${username}
        WHERE ${raw(ProfileCol.id)} = ${profileId}
          AND (${raw(ProfileCol.username)} = '' OR ${raw(ProfileCol.username)} IS NULL)
      `);
      const card = await readProfileCardById(db, profileId);
      if (card !== null && card.username.length > 0) {
        return card.username;
      }
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }
  throw new ProfileError(
    'PROFILE_USERNAME_TAKEN',
    'could not assign a unique username'
  );
}

/**
 * Ensures a Postgres profile row exists for `profileId` and that it has a
 * globally unique username. Does not set `username_changed_at` so the first
 * user-initiated change stays free of the cooldown.
 */
export async function ensureProfileWithUsername(
  db: SqlClient,
  profileId: string
): Promise<ProfileCard> {
  const now = new Date().toISOString();
  const existing = await readProfileCardById(db, profileId);
  if (existing === null) {
    for (
      let attempt = 0;
      attempt < MAX_USERNAME_ASSIGN_ATTEMPTS;
      attempt += 1
    ) {
      const username = generateRandomUsername(`${profileId}:${attempt}`);
      try {
        await insertProfileRow(db, profileId, username, now);
        break;
      } catch (error) {
        if (isUniqueViolation(error)) continue;
        throw error;
      }
    }
  }

  let card = await readProfileCardById(db, profileId);
  if (card === null) {
    throw new ProfileError('PROFILE_NOT_FOUND', 'profile could not be created');
  }
  if (card.username.length === 0) {
    await assignUniqueUsername(db, profileId);
    card = await readProfileCardById(db, profileId);
    if (card === null) {
      throw new ProfileError(
        'PROFILE_NOT_FOUND',
        'profile missing after ensure'
      );
    }
  }
  return card;
}
