/**
 * Identities (`idp_accounts`): who can sign in as which user — one row per
 * provider account or emailed-link address.
 *
 * Addresses are stored lowercased so matching is plain equality, and the
 * provider's verification is stored with them — a verified Google address and
 * an unverified one are not the same claim, and linking depends on that.
 */

import type { SignInMethodId } from '@pkgs/auth-root-shared/sign-in-method';
import { isSignInMethodId } from '@pkgs/auth-root-shared/sign-in-method';
import type { Clock } from '@pkgs/clock-shared/types';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql, { raw } from '@pkgs/sql-root-shared/sql';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import { isoFromMs } from './idp-repository';
import type { ProviderIdentity } from './provider-identity';

export type IdentityRow = {
  readonly id: string;
  readonly userId: string;
  readonly provider: SignInMethodId;
  readonly providerUserId: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly isPrivateEmail: boolean;
  readonly emailForwarding: boolean;
  readonly name: string | null;
  readonly picture: string | null;
  readonly refreshToken: string | null;
  readonly linkedAt: string;
  readonly lastSignInAt: string | null;
};

type RawIdentityRow = {
  readonly id: string;
  readonly user_id: string;
  readonly provider: string;
  readonly provider_user_id: string;
  readonly email: string | null;
  readonly email_verified: unknown;
  readonly is_private_email: unknown;
  readonly email_forwarding: unknown;
  readonly name: string | null;
  readonly picture: string | null;
  readonly refresh_token: string | null;
  readonly created_at: unknown;
  readonly last_sign_in_at: unknown;
};

/** Engines hand booleans back as `true`, `1`, `'1'` or `'t'`. */
function flag(value: unknown, fallback: boolean): boolean {
  if (value === null || value === undefined) return fallback;
  return value === true || value === 1 || value === '1' || value === 't';
}

function iso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function mapRow(row: RawIdentityRow): IdentityRow {
  // Only the linker writes this column, and only with a sign-in method id.
  if (!isSignInMethodId(row.provider)) {
    throw new Error(`idp_accounts: unknown provider ${row.provider}`);
  }
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerUserId: row.provider_user_id,
    email: row.email,
    emailVerified: flag(row.email_verified, false),
    isPrivateEmail: flag(row.is_private_email, false),
    emailForwarding: flag(row.email_forwarding, true),
    name: row.name,
    picture: row.picture,
    refreshToken: row.refresh_token,
    linkedAt: iso(row.created_at) ?? new Date(0).toISOString(),
    lastSignInAt: iso(row.last_sign_in_at),
  };
}

const COLUMNS = raw(
  'id, user_id, provider, provider_user_id, email, email_verified, is_private_email, email_forwarding, name, picture, refresh_token, created_at, last_sign_in_at'
);

export class IdentityRepository {
  constructor(
    private readonly db: SqlTx,
    private readonly clock: Clock,
    private readonly createId: CreateId
  ) {}

  async find(
    provider: string,
    providerUserId: string
  ): Promise<IdentityRow | null> {
    const rows = await this.db.query(sql<RawIdentityRow>`
      SELECT ${COLUMNS} FROM idp_accounts
      WHERE provider = ${provider}
        AND provider_user_id = ${providerUserId}
        AND deleted_at IS NULL
      LIMIT 1
    `);
    const row = rows[0];
    return row === undefined ? null : mapRow(row);
  }

  /** A user's identities, oldest link first. */
  async listForUser(userId: string): Promise<IdentityRow[]> {
    const rows = await this.db.query(sql<RawIdentityRow>`
      SELECT ${COLUMNS} FROM idp_accounts
      WHERE user_id = ${userId} AND deleted_at IS NULL
      ORDER BY created_at, id
    `);
    return rows.map(mapRow);
  }

  /**
   * Identities elsewhere that claim `email` (relay addresses excluded: a
   * relay is unique to one Apple account and one developer team).
   */
  async findByEmail(email: string): Promise<IdentityRow[]> {
    const rows = await this.db.query(sql<RawIdentityRow>`
      SELECT ${COLUMNS} FROM idp_accounts
      WHERE email = ${email.toLowerCase()} AND deleted_at IS NULL
      ORDER BY created_at, id
    `);
    return rows.map(mapRow).filter((row) => !row.isPrivateEmail);
  }

  /**
   * Attach an identity to `userId`. Concurrent callbacks race on the unique
   * `(provider, provider_user_id)`; the loser adopts the winner's owner.
   *
   * @returns the user the identity belongs to after the insert.
   */
  async insert(userId: string, identity: ProviderIdentity): Promise<string> {
    const now = isoFromMs(this.clock.now());
    await this.db.run(sql`
      INSERT INTO idp_accounts (
        id, created_at, updated_at, user_id, provider, provider_user_id,
        access_token, refresh_token, email, email_verified, is_private_email,
        email_forwarding, name, picture, last_sign_in_at
      )
      VALUES (
        ${this.createId()}, ${now}, ${now}, ${userId}, ${identity.provider},
        ${identity.providerUserId}, ${identity.accessToken},
        ${identity.refreshToken}, ${identity.email}, ${identity.emailVerified},
        ${identity.isPrivateEmail}, ${true}, ${identity.name},
        ${identity.picture}, ${now}
      )
      ON CONFLICT (provider, provider_user_id) DO NOTHING
    `);
    const owner = await this.find(identity.provider, identity.providerUserId);
    if (owner === null) throw new Error('identity missing after insert');
    return owner.userId;
  }

  /**
   * What the provider says now: the address can change under a stable
   * subject, and a name Apple sent once must not be erased by its silence.
   */
  async refresh(identity: ProviderIdentity): Promise<void> {
    const now = isoFromMs(this.clock.now());
    await this.db.run(sql`
      UPDATE idp_accounts
      SET email = ${identity.email},
          email_verified = ${identity.emailVerified},
          is_private_email = ${identity.isPrivateEmail},
          name = COALESCE(${identity.name}, name),
          picture = COALESCE(${identity.picture}, picture),
          access_token = ${identity.accessToken},
          refresh_token = COALESCE(${identity.refreshToken}, refresh_token),
          last_sign_in_at = ${now},
          updated_at = ${now}
      WHERE provider = ${identity.provider}
        AND provider_user_id = ${identity.providerUserId}
    `);
  }

  async remove(userId: string, provider: SignInMethodId): Promise<void> {
    await this.db.run(sql`
      DELETE FROM idp_accounts
      WHERE user_id = ${userId} AND provider = ${provider}
    `);
  }

  async removeIdentity(
    provider: string,
    providerUserId: string
  ): Promise<void> {
    await this.db.run(sql`
      DELETE FROM idp_accounts
      WHERE provider = ${provider} AND provider_user_id = ${providerUserId}
    `);
  }

  async setForwarding(
    provider: string,
    providerUserId: string,
    forwarding: boolean
  ): Promise<void> {
    await this.db.run(sql`
      UPDATE idp_accounts
      SET email_forwarding = ${forwarding},
          updated_at = ${isoFromMs(this.clock.now())}
      WHERE provider = ${provider} AND provider_user_id = ${providerUserId}
    `);
  }

  /** `true` when this provider event was already applied (and records it). */
  async seenEvent(args: {
    readonly provider: string;
    readonly jti: string;
    readonly type: string;
    readonly providerUserId: string;
  }): Promise<boolean> {
    const rows = await this.db.query(sql<{ id: string }>`
      SELECT id FROM idp_provider_events
      WHERE provider = ${args.provider} AND jti = ${args.jti}
      LIMIT 1
    `);
    if (rows[0] !== undefined) return true;
    const now = isoFromMs(this.clock.now());
    await this.db.run(sql`
      INSERT INTO idp_provider_events (
        id, created_at, updated_at, provider, jti, type, provider_user_id
      )
      VALUES (
        ${this.createId()}, ${now}, ${now}, ${args.provider}, ${args.jti},
        ${args.type}, ${args.providerUserId}
      )
    `);
    return false;
  }
}
