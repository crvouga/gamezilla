import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import {
  managedInsertColumns,
  managedUpdatedAtIso,
} from '@pkgs/sync-engine-shared/managed-columns';
import type { CreateId } from '@pkgs/uuid-shared/create-id';

type MembershipRow = {
  readonly id: string;
  readonly user_id: string;
  readonly deleted_at: string | null;
};

/**
 * A device's time in an account (`auth_account_devices`): live while the
 * device is signed into that account, tombstoned when it leaves (signs out,
 * or signs into another account).
 *
 * `auth_devices` holds one row per install whose `user_id` moves with the
 * install, so the account the device left never sees it go (its synced copy
 * keeps the old owner). The tombstone is what reaches that account and takes
 * the device off its list.
 */
export class AccountDeviceMembership {
  constructor(
    private readonly tx: SqlTx,
    private readonly time: {
      readonly now: () => number;
      readonly createId: CreateId;
    }
  ) {}

  /**
   * `deviceId` now belongs to `toUserId`; `fromAccountId` is the signed-in
   * account that held it before (`null` when unbound or a guest). Tombstones
   * every other account's membership (and writes one for `fromAccountId`
   * when it never had a row), then, when
   * `toUserId` is a signed-in account, records the device as live there.
   *
   * Returns the accounts the device left, whose devices lists must hear it.
   */
  async move(args: {
    readonly deviceId: string;
    readonly fromAccountId: string | null;
    readonly toUserId: string;
    readonly toIsAccount: boolean;
  }): Promise<readonly string[]> {
    const { deviceId, fromAccountId, toUserId } = args;
    const rows = await this.rowsFor(deviceId);
    const left = new Set<string>();
    for (const row of rows) {
      if (row.user_id === toUserId || row.deleted_at !== null) continue;
      await this.setDeleted(row.id, managedUpdatedAtIso(this.time.now));
      left.add(row.user_id);
    }
    if (
      fromAccountId !== null &&
      fromAccountId !== toUserId &&
      !rows.some((row) => row.user_id === fromAccountId)
    ) {
      await this.insert(fromAccountId, deviceId, true);
      left.add(fromAccountId);
    }
    if (args.toIsAccount) {
      const mine = rows.find((row) => row.user_id === toUserId);
      if (mine === undefined) await this.insert(toUserId, deviceId, false);
      else if (mine.deleted_at !== null) await this.setDeleted(mine.id, null);
    }
    return [...left].sort();
  }

  /**
   * No device is signed into `accountId` any more (it has no sign-in method
   * left, so every session of it ended): tombstone every live membership at
   * once, instead of waiting for each device to come back as a guest. Returns
   * the devices that left.
   */
  async endAll(accountId: string): Promise<readonly string[]> {
    const rows = await this.tx.query(sql<{
      readonly id: string;
      readonly device_id: string;
    }>`
      SELECT id, device_id
      FROM auth_account_devices
      WHERE user_id = ${accountId} AND deleted_at IS NULL
      ORDER BY id
    `);
    const now = managedUpdatedAtIso(this.time.now);
    for (const row of rows) await this.setDeleted(row.id, now);
    return rows.map((row) => row.device_id);
  }

  private async rowsFor(deviceId: string): Promise<readonly MembershipRow[]> {
    return await this.tx.query(sql<MembershipRow>`
      SELECT id, user_id, deleted_at
      FROM auth_account_devices
      WHERE device_id = ${deviceId}
      ORDER BY id
    `);
  }

  private async setDeleted(
    id: string,
    deletedAt: string | null
  ): Promise<void> {
    await this.tx.run(sql<void>`
      UPDATE auth_account_devices
      SET deleted_at = ${deletedAt},
          updated_at = ${managedUpdatedAtIso(this.time.now)}
      WHERE id = ${id}
    `);
  }

  private async insert(
    userId: string,
    deviceId: string,
    left: boolean
  ): Promise<void> {
    const managed = managedInsertColumns(this.time.createId, this.time.now);
    await this.tx.run(sql<void>`
      INSERT INTO auth_account_devices (
        id, created_at, updated_at, deleted_at, user_id, device_id
      )
      VALUES (
        ${managed.id}, ${managed.created_at}, ${managed.updated_at},
        ${left ? managed.updated_at : null}, ${userId}, ${deviceId}
      )
    `);
  }
}
