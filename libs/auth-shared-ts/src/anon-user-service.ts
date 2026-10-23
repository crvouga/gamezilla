import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import type { Value } from '@pkgs/sql-root-shared-ts/sql';
import sql, { join, raw } from '@pkgs/sql-root-shared-ts/sql';
import {
  managedInsertColumns,
  managedUpdatedAtIso,
} from '@pkgs/sync-engine-shared-ts/managed-columns';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import { assertUuid } from '@pkgs/uuid-shared-ts/uuid';
import { AccountDeviceMembership } from './account-device-membership';
import { assertDeviceId } from './device-id';

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

export type EnsureAnonUserResult = {
  readonly userId: string;
  readonly isAnon: true;
  /** Signed-in accounts this device just left (their devices lists change). */
  readonly leftAccountIds: readonly string[];
};

/** Transaction-scoped anon user helpers. Open a transaction in a use case. */
export class AnonUserService {
  constructor(
    private readonly tx: SqlTx,
    private readonly time: {
      readonly clock: Clock;
      readonly createId: CreateId;
    }
  ) {}

  /**
   * Ensures the install device is bound to an anon `users` row (caller must be
   * inside a transaction).
   *
   * - Idempotent when already bound to an anon user (unless `forceNew`).
   * - Mints a new anon user when unbound, bound to a non-anon user, or
   *   `forceNew` (sign-out).
   */
  async ensureForDevice(args: {
    readonly deviceId: string;
    readonly forceNew?: boolean;
    readonly userId?: string;
    readonly now?: () => number;
    readonly createId?: CreateId;
  }): Promise<EnsureAnonUserResult> {
    const { deviceId, forceNew = false } = args;
    const now = args.now ?? this.time.clock.now;
    const createId = args.createId ?? this.time.createId;
    assertDeviceId(deviceId);

    if (!forceNew) {
      const boundUserId = await this.readDeviceUserId(deviceId);
      if (boundUserId !== null) {
        const anon = await this.readUserIsAnon(boundUserId);
        if (anon === true) {
          assertUuid(boundUserId, 'userId must be UUID');
          return {
            userId: boundUserId,
            isAnon: true as const,
            leftAccountIds: [],
          };
        }
      }
    }

    const userId = await this.resolveMintUserId(args.userId, createId);
    assertUuid(userId, 'userId must be UUID');
    await this.insertAnonUser(userId, now, createId);
    const leftAccountIds = await this.bindDeviceToUser({
      deviceId,
      userId,
      now,
      createId,
    });
    return { userId, isAnon: true as const, leftAccountIds };
  }

  /** Uses a client-proposed id when unbound (or forceNew), unless it is a non-anon user. */
  private async resolveMintUserId(
    proposed: string | undefined,
    createId: CreateId
  ): Promise<string> {
    if (proposed === undefined) return createId();
    assertUuid(proposed, 'userId must be UUID');
    const rows = await this.tx.query(sql<
      UserAnonRow & { deleted_at: string | null }
    >`
      SELECT id, is_anon, deleted_at FROM auth_users WHERE id = ${proposed} LIMIT 1
    `);
    const existing = rows[0];
    if (
      existing !== undefined &&
      (existing.deleted_at !== null || !isAnonFlag(existing.is_anon))
    )
      return createId();
    return proposed;
  }

  /** Looks up `devices.user_id` for session / sync resolution. */
  async findUserIdByDeviceId(deviceId: string): Promise<string | null> {
    assertDeviceId(deviceId);
    return this.readDeviceUserId(deviceId);
  }

  async readUserAnonState(
    userId: string
  ): Promise<{ readonly exists: boolean; readonly isAnon: boolean }> {
    assertUuid(userId, 'userId must be UUID');
    const anon = await this.readUserIsAnon(userId);
    if (anon === null) return { exists: false, isAnon: false };
    return { exists: true, isAnon: anon };
  }

  /** Clears `is_anon` on an upgraded user row. */
  async clearUserAnonFlag(userId: string, now: () => number): Promise<void> {
    assertUuid(userId, 'userId must be UUID');
    const nowIso = managedUpdatedAtIso(now);
    await this.tx.run(sql<void>`
      UPDATE auth_users
      SET is_anon = false, updated_at = ${nowIso}
      WHERE id = ${userId}
    `);
  }

  private async readDeviceUserId(deviceId: string): Promise<string | null> {
    const rows = await this.tx.query(sql<DeviceUserRow>`
      SELECT user_id
      FROM auth_devices
      WHERE id = ${deviceId} AND deleted_at IS NULL
      LIMIT 1
    `);
    const userId = rows[0]?.user_id;
    return typeof userId === 'string' && userId.length > 0 ? userId : null;
  }

  private async readUserIsAnon(userId: string): Promise<boolean | null> {
    const rows = await this.tx.query(sql<UserAnonRow>`
      SELECT id, is_anon
      FROM auth_users
      WHERE id = ${userId} AND deleted_at IS NULL
      LIMIT 1
    `);
    const row = rows[0];
    if (row === undefined) return null;
    return isAnonFlag(row.is_anon);
  }

  private async insertAnonUser(
    userId: string,
    now: () => number,
    createId: CreateId
  ): Promise<void> {
    const managed = managedInsertColumns(createId, now, userId);
    await this.tx.run(sql<void>`
      INSERT INTO auth_users (id, created_at, updated_at, is_anon)
      VALUES (
        ${managed.id},
        ${managed.created_at},
        ${managed.updated_at},
        true
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }

  /** Binds the device to (anon) `userId`; returns the accounts it left. */
  private async bindDeviceToUser(args: {
    readonly deviceId: string;
    readonly userId: string;
    readonly now: () => number;
    readonly createId: CreateId;
  }): Promise<readonly string[]> {
    const { deviceId, userId, now, createId } = args;
    const previous = await this.readDeviceUserId(deviceId);
    const fromAccountId =
      previous !== null && (await this.readUserIsAnon(previous)) === false
        ? previous
        : null;
    await this.writeDeviceUser({ deviceId, userId, now, createId });
    return await new AccountDeviceMembership(this.tx, { now, createId }).move({
      deviceId,
      fromAccountId,
      toUserId: userId,
      toIsAccount: false,
    });
  }

  private async writeDeviceUser(args: {
    readonly deviceId: string;
    readonly userId: string;
    readonly now: () => number;
    readonly createId: CreateId;
  }): Promise<void> {
    const { deviceId, userId, now, createId } = args;
    const nowIso = managedUpdatedAtIso(now);
    const rows = await this.tx.query(sql<{ readonly id: string }>`
      SELECT id FROM auth_devices WHERE id = ${deviceId} LIMIT 1
    `);
    if (rows[0] === undefined) {
      const managed = managedInsertColumns(createId, now, deviceId);
      const cols = [
        'id',
        'created_at',
        'updated_at',
        'user_id',
        'first_seen_at',
        'last_seen_at',
      ];
      const vals: Value[] = [
        managed.id,
        managed.created_at,
        managed.updated_at,
        userId,
        managed.created_at,
        managed.created_at,
      ];
      await this.tx.run(sql<void>`
        INSERT INTO auth_devices (${raw(cols.join(', '))})
        VALUES ${join(vals, ', ', '(', ')')}
      `);
      return;
    }
    await this.tx.run(sql<void>`
      UPDATE auth_devices
      SET user_id = ${userId},
          deleted_at = NULL,
          last_seen_at = ${nowIso},
          updated_at = ${nowIso}
      WHERE id = ${deviceId}
    `);
  }
}
