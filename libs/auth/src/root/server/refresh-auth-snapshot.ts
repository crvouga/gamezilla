import { assertDeviceId, assertUuid } from '@libs/auth/public/device-id';
import type { AuthServerPort } from '@pkgs/auth/server';
import type { AuthUser, VerifiedSession } from '@pkgs/auth/shared';
import { join, raw, sql, type Value } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';
import { ExternalAccountRepository } from '../../public/external-account-repository';
import { managedInsertColumns } from '../../public/managed-row';
import { AccountDeviceMembership } from '../../shared/auth/writes/account-device-membership';
import { LinkedIdentityMirror } from './linked-identity-mirror';

/**
 * Idempotent server-side upsert run from `POST /identity/refresh`. Given a
 * resolved `accountId` (users.id) plus the client's device snapshot, mirrors
 * the auth provider user into auth_external_accounts and binds the device row.
 */
export class AuthSnapshotRefresher {
  constructor(
    private readonly db: SqlClient,
    private readonly authServer: AuthServerPort
  ) {}

  /** Returns the other accounts the device left by signing into this one. */
  async refresh(args: {
    bearerToken: string;
    accountId: string;
    deviceId: string;
    deviceAttributes: Record<string, string | null>;
    now: () => number;
    createId: CreateId;
  }): Promise<readonly string[]> {
    const {
      bearerToken,
      accountId,
      deviceId,
      deviceAttributes,
      now,
      createId,
    } = args;
    assertUuid(accountId, 'accountId must be UUID');
    assertDeviceId(deviceId);

    await this.upsertAuthUserFromBearer({
      bearerToken,
      accountId,
      now,
      createId,
    });
    const fromAccountId = await this.accountHoldingDevice(deviceId);
    await this.upsertDeviceRow({
      deviceId,
      userId: accountId,
      attributes: deviceAttributes,
      now,
      createId,
    });
    return await new AccountDeviceMembership(this.db, { now, createId }).move({
      deviceId,
      fromAccountId,
      toUserId: accountId,
      toIsAccount: true,
    });
  }

  /** The signed-in (non-guest) account the device is bound to, if any. */
  private async accountHoldingDevice(deviceId: string): Promise<string | null> {
    const rows = await this.db.query(sql<{
      readonly user_id: string;
      readonly is_anon: unknown;
    }>`
      SELECT d.user_id, u.is_anon
      FROM auth_devices d
      JOIN auth_users u ON u.id = d.user_id
      WHERE d.id = ${deviceId}
      LIMIT 1
    `);
    const row = rows[0];
    if (row === undefined) return null;
    const anon =
      row.is_anon === true ||
      row.is_anon === 1 ||
      row.is_anon === '1' ||
      row.is_anon === 't';
    return anon ? null : row.user_id;
  }

  private async upsertAuthUserFromBearer(args: {
    bearerToken: string;
    accountId: string;
    now: () => number;
    createId: CreateId;
  }): Promise<void> {
    const { bearerToken, accountId, now, createId } = args;

    let session: VerifiedSession | null = null;
    try {
      session = await this.authServer.verifySessionToken(bearerToken);
    } catch {
      session = null;
    }
    if (session === null) return;

    let user: AuthUser | null = null;
    try {
      user = await this.authServer.getUser(session.externalUserId);
    } catch {
      user = null;
    }
    const email = session.email ?? user?.email ?? undefined;

    const externalAccounts = new ExternalAccountRepository(this.db);
    await externalAccounts.upsertExternalAccount({
      userId: accountId,
      provider: this.authServer.provider,
      externalId: session.externalUserId,
      metadata: email === undefined ? {} : { email },
      now,
      createId,
    });
    // Only a real read lists sign-in methods; a failed one must not
    // tombstone the ones already mirrored.
    if (user !== null) {
      await new LinkedIdentityMirror(this.db, { now, createId }).mirror(
        accountId,
        user.identities
      );
    }
  }

  private async upsertDeviceRow(args: {
    deviceId: string;
    userId: string;
    attributes: Record<string, string | null>;
    now: () => number;
    createId: CreateId;
  }): Promise<void> {
    const { deviceId, userId, attributes, now, createId } = args;
    const rows = await this.db.query(sql<DeviceRow>`
      SELECT *
      FROM auth_devices
      WHERE id = ${deviceId}
      LIMIT 1
    `);
    const existing = rows[0];
    const nowIso = new Date(now()).toISOString();

    if (existing === undefined) {
      const managed = managedInsertColumns(createId, now, deviceId);
      const cols: string[] = [
        'id',
        'created_at',
        'updated_at',
        'user_id',
        'first_seen_at',
        'last_seen_at',
      ];
      const vals: (string | null)[] = [
        managed.id,
        managed.created_at,
        managed.updated_at,
        userId,
        managed.created_at,
        managed.created_at,
      ];
      for (const [key, value] of Object.entries(attributes)) {
        if (value === null) continue;
        cols.push(key);
        vals.push(value);
      }
      await this.db.run(sql<void>`
        INSERT INTO auth_devices (${raw(cols.join(', '))})
        VALUES ${join(vals as Value[], ', ', '(', ')')}
      `);
      return;
    }

    const existingFirst = readNullableString(existing['first_seen_at']);
    const created = readNullableString(existing['created_at']);
    const updates: Record<string, string> = {
      user_id: userId,
      last_seen_at: nowIso,
      updated_at: nowIso,
      ...(existingFirst === null
        ? { first_seen_at: created !== null ? created : nowIso }
        : {}),
    };
    for (const [key, next] of Object.entries(attributes)) {
      if (next === null) continue;
      if (existing[key] !== next) {
        updates[key] = next;
      }
    }
    const entries = Object.entries(updates);
    if (entries.length === 0) return;
    const sets = join(
      entries.map(([column, value]) => sql<void>`${raw(column)} = ${value}`)
    );
    await this.db.run(sql<void>`
      UPDATE auth_devices
      SET ${sets}
      WHERE id = ${deviceId}
    `);
  }
}

type DeviceRow = Record<string, unknown>;

function readNullableString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}
