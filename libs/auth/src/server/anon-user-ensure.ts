import { assertDeviceId, assertUuid } from '@libs/auth/shared/device-id';
import { join, raw, sql, type Value } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

type DeviceUserRow = {
  readonly user_id: string | null;
};

type UserAnonRow = {
  readonly id: string;
  readonly is_anon: boolean | number | string | null;
};

function isAnonFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 't';
}

async function readDeviceUserId(
  db: SqlClient,
  deviceId: string
): Promise<string | null> {
  const rows = await db.query(sql<DeviceUserRow>`
    SELECT user_id
    FROM devices
    WHERE id = ${deviceId}
    LIMIT 1
  `);
  const userId = rows[0]?.user_id;
  return typeof userId === 'string' && userId.length > 0 ? userId : null;
}

async function readUserIsAnon(
  db: SqlClient,
  userId: string
): Promise<boolean | null> {
  const rows = await db.query(sql<UserAnonRow>`
    SELECT id, is_anon
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `);
  const row = rows[0];
  if (row === undefined) return null;
  return isAnonFlag(row.is_anon);
}

async function insertAnonUser(db: SqlClient, userId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.run(sql<void>`
    INSERT INTO users (id, created_at, is_anon)
    VALUES (${userId}, ${now}, true)
    ON CONFLICT (id) DO NOTHING
  `);
}

async function bindDeviceToUser(
  db: SqlClient,
  deviceId: string,
  userId: string
): Promise<void> {
  const now = new Date().toISOString();
  const rows = await db.query(sql<{ readonly id: string }>`
    SELECT id FROM devices WHERE id = ${deviceId} LIMIT 1
  `);
  if (rows[0] === undefined) {
    const cols = [
      'id',
      'user_id',
      'created_at',
      'first_seen_at',
      'last_seen_at',
    ];
    const vals: Value[] = [deviceId, userId, now, now, now];
    await db.run(sql<void>`
      INSERT INTO devices (${raw(cols.join(', '))})
      VALUES ${join(vals, ', ', '(', ')')}
    `);
    return;
  }
  await db.run(sql<void>`
    UPDATE devices
    SET user_id = ${userId}, last_seen_at = ${now}
    WHERE id = ${deviceId}
  `);
}

export type EnsureAnonUserResult = {
  readonly userId: string;
  readonly isAnon: true;
};

/**
 * Ensures the install device is bound to an anon `users` row.
 *
 * - Idempotent when already bound to an anon user (unless `forceNew`).
 * - Mints a new anon user when unbound, bound to a non-anon user, or
 *   `forceNew` (sign-out).
 */
export async function ensureAnonUserForDevice(args: {
  readonly sql: SqlClient;
  readonly deviceId: string;
  readonly forceNew?: boolean;
}): Promise<EnsureAnonUserResult> {
  const { sql: db, deviceId, forceNew = false } = args;
  assertDeviceId(deviceId);

  return db.transaction(async (tx) => {
    if (!forceNew) {
      const boundUserId = await readDeviceUserId(tx, deviceId);
      if (boundUserId !== null) {
        const anon = await readUserIsAnon(tx, boundUserId);
        if (anon === true) {
          assertUuid(boundUserId, 'userId must be UUID');
          return { userId: boundUserId, isAnon: true as const };
        }
      }
    }

    const userId = crypto.randomUUID();
    assertUuid(userId, 'userId must be UUID');
    await insertAnonUser(tx, userId);
    await bindDeviceToUser(tx, deviceId, userId);
    return { userId, isAnon: true as const };
  });
}

/** Looks up `devices.user_id` for session / sync resolution. */
export async function findUserIdByDeviceId(
  db: SqlClient,
  deviceId: string
): Promise<string | null> {
  assertDeviceId(deviceId);
  return readDeviceUserId(db, deviceId);
}

export async function readUserAnonState(
  db: SqlClient,
  userId: string
): Promise<{ readonly exists: boolean; readonly isAnon: boolean }> {
  assertUuid(userId, 'userId must be UUID');
  const anon = await readUserIsAnon(db, userId);
  if (anon === null) return { exists: false, isAnon: false };
  return { exists: true, isAnon: anon };
}

/** Clears `is_anon` on an upgraded user row. */
export async function clearUserAnonFlag(
  db: SqlClient,
  userId: string
): Promise<void> {
  assertUuid(userId, 'userId must be UUID');
  await db.run(sql<void>`
    UPDATE users
    SET is_anon = false
    WHERE id = ${userId}
  `);
}
