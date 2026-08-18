import { assertDeviceId, assertUuid } from '@libs/auth/public/device-id';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import { join, raw, sql, type Value } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';
import { ExternalAccountRepository } from '../../public/external-account-repository';
import { managedInsertColumns } from '../../public/managed-row';
import { readPrimaryEmailFromAuthSnapshot } from './auth-user-snapshot';

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

  async refresh(args: {
    bearerToken: string;
    accountId: string;
    deviceId: string;
    deviceAttributes: Record<string, string | null>;
    now: () => number;
    createId: CreateId;
  }): Promise<void> {
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
    await this.upsertDeviceRow({
      deviceId,
      userId: accountId,
      attributes: deviceAttributes,
      now,
      createId,
    });
  }

  private async upsertAuthUserFromBearer(args: {
    bearerToken: string;
    accountId: string;
    now: () => number;
    createId: CreateId;
  }): Promise<void> {
    const { bearerToken, accountId, now, createId } = args;

    let session: Awaited<ReturnType<AuthServerPort['verifySessionToken']>> =
      null;
    try {
      session = await this.authServer.verifySessionToken(bearerToken);
    } catch {
      session = null;
    }
    if (session === null) return;

    let snapshot: Record<string, unknown> | null = null;
    try {
      snapshot = await this.authServer.getUserSnapshot(session.externalUserId);
    } catch {
      snapshot = null;
    }
    const data = snapshot ?? { id: session.externalUserId };
    const email =
      session.email ?? readPrimaryEmailFromAuthSnapshot(data) ?? undefined;

    const externalAccounts = new ExternalAccountRepository(this.db);
    await externalAccounts.upsertExternalAccount({
      userId: accountId,
      provider: this.authServer.providerLabel,
      externalId: session.externalUserId,
      metadata: email === undefined ? {} : { email },
      now,
      createId,
    });
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
