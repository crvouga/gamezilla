/**
 * Mirrors the account's sign-in methods (Google, Apple) from the IdP into the
 * synced `auth_external_accounts` table, one row per provider, so the client
 * reads them from local SQLite like any other synced data.
 *
 * The IdP is the source of truth. A provider the IdP no longer lists is
 * tombstoned (`deleted_at`), never hard-deleted; relinking revives the
 * user's row for that provider (possibly with a new subject), and an identity
 * that moved from another user is re-homed onto this one.
 */

import { OAUTH_PROVIDER_IDS, type OauthProviderId } from '@pkgs/auth/shared';
import { sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';

import {
  managedInsertColumns,
  managedUpdatedAtIso,
} from '../../public/managed-row';

/** One identity as the IdP user snapshot lists it (`accounts[]`). */
export type SnapshotIdentity = {
  readonly provider: OauthProviderId;
  readonly providerUserId: string;
  readonly metadata: Record<string, unknown>;
};

type MirrorRow = {
  readonly id: string;
  readonly user_id: string;
  readonly deleted_at: string | null;
};

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** The provider identities in an IdP user snapshot. */
export function readSnapshotIdentities(
  snapshot: Record<string, unknown>
): SnapshotIdentity[] {
  const raw = snapshot['accounts'];
  if (!Array.isArray(raw)) return [];
  const out: SnapshotIdentity[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const provider = readString(row['provider']);
    const providerUserId = readString(row['providerUserId']);
    if (provider === null || providerUserId === null) continue;
    if (!(OAUTH_PROVIDER_IDS as readonly string[]).includes(provider)) continue;
    out.push({
      provider: provider as OauthProviderId,
      providerUserId,
      metadata: {
        email: row['email'] ?? null,
        emailVerified: row['emailVerified'] === true,
        isPrivateEmail: row['isPrivateEmail'] === true,
        emailForwarding: row['emailForwarding'] !== false,
        name: row['name'] ?? null,
        linkedAt: row['linkedAt'] ?? null,
        lastSignInAt: row['lastSignInAt'] ?? null,
      },
    });
  }
  return out;
}

export class LinkedIdentityMirror {
  constructor(
    private readonly tx: SqlTx,
    private readonly time: {
      readonly now: () => number;
      readonly createId: CreateId;
    }
  ) {}

  async mirror(
    userId: string,
    identities: readonly SnapshotIdentity[]
  ): Promise<void> {
    for (const provider of OAUTH_PROVIDER_IDS) {
      const identity = identities.find((row) => row.provider === provider);
      if (identity === undefined) await this.tombstone(userId, provider);
      else await this.upsert(userId, identity);
    }
  }

  private async rowFor(
    userId: string,
    provider: string
  ): Promise<MirrorRow | null> {
    const rows = await this.tx.query(sql<MirrorRow>`
      SELECT id, user_id, deleted_at FROM auth_external_accounts
      WHERE user_id = ${userId} AND provider = ${provider}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private async rowForIdentity(
    identity: SnapshotIdentity
  ): Promise<MirrorRow | null> {
    const rows = await this.tx.query(sql<MirrorRow>`
      SELECT id, user_id, deleted_at FROM auth_external_accounts
      WHERE provider = ${identity.provider}
        AND external_id = ${identity.providerUserId}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private async write(
    id: string,
    userId: string,
    identity: SnapshotIdentity
  ): Promise<void> {
    const nowIso = managedUpdatedAtIso(this.time.now);
    await this.tx.run(sql<void>`
      UPDATE auth_external_accounts
      SET user_id = ${userId},
          external_id = ${identity.providerUserId},
          metadata = ${JSON.stringify(identity.metadata)},
          deleted_at = ${null},
          updated_at = ${nowIso}
      WHERE id = ${id}
    `);
  }

  /**
   * Another user's stale row still names this identity; both it and this
   * user's own row for the provider cannot hold `(provider, external_id)`, so
   * the stale one is tombstoned under a retired subject.
   */
  private async retire(
    row: MirrorRow,
    identity: SnapshotIdentity
  ): Promise<void> {
    const nowIso = managedUpdatedAtIso(this.time.now);
    const retired = `${identity.providerUserId}:retired:${this.time.createId()}`;
    await this.tx.run(sql<void>`
      UPDATE auth_external_accounts
      SET external_id = ${retired},
          deleted_at = COALESCE(deleted_at, ${nowIso}),
          updated_at = ${nowIso}
      WHERE id = ${row.id}
    `);
  }

  private async upsert(
    userId: string,
    identity: SnapshotIdentity
  ): Promise<void> {
    const mine = await this.rowFor(userId, identity.provider);
    const elsewhere = await this.rowForIdentity(identity);
    if (mine !== null) {
      if (elsewhere !== null && elsewhere.id !== mine.id) {
        await this.retire(elsewhere, identity);
      }
      await this.write(mine.id, userId, identity);
      return;
    }
    if (elsewhere !== null) {
      await this.write(elsewhere.id, userId, identity);
      return;
    }
    // A minted id, not `provider:subject`: the row outlives a subject change
    // (relinking another account of the same provider) and must keep its id.
    const managed = managedInsertColumns(this.time.createId, this.time.now);
    await this.tx.run(sql<void>`
      INSERT INTO auth_external_accounts (
        id, created_at, updated_at, user_id, provider, external_id, metadata
      )
      VALUES (
        ${managed.id}, ${managed.created_at}, ${managed.updated_at}, ${userId},
        ${identity.provider}, ${identity.providerUserId},
        ${JSON.stringify(identity.metadata)}
      )
    `);
  }

  private async tombstone(userId: string, provider: string): Promise<void> {
    const mine = await this.rowFor(userId, provider);
    if (mine === null || mine.deleted_at !== null) return;
    const nowIso = managedUpdatedAtIso(this.time.now);
    await this.tx.run(sql<void>`
      UPDATE auth_external_accounts
      SET deleted_at = ${nowIso}, updated_at = ${nowIso}
      WHERE id = ${mine.id}
    `);
  }
}
