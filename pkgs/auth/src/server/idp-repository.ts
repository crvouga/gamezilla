import type { Clock } from '@pkgs/clock';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';

import {
  AUTH_OAUTH_STATE_TTL_MS,
  AUTH_SESSION_TTL_MS,
} from '../shared/auth-constants';
import { pkceCodeVerifier } from '../shared/pkce';
import { hashAuthSecret } from '../shared/token-hash';

export type IdpUserRow = {
  readonly id: string;
  readonly email: string | null;
  readonly name: string | null;
  readonly image: string | null;
};

export type IdpSessionRow = {
  readonly id: string;
  readonly user_id: string;
  readonly token_hash: string;
  readonly expires_at: string;
};

function isoFromMs(ms: number): string {
  return new Date(ms).toISOString();
}

export class IdpRepository {
  constructor(
    private readonly db: SqlClient,
    private readonly clock: Clock,
    private readonly createId: CreateId,
    private readonly secret: string
  ) {}

  async findUserById(id: string): Promise<IdpUserRow | null> {
    const rows = await this.db.query(sql<IdpUserRow>`
      SELECT id, email, name, image
      FROM idp_users
      WHERE id = ${id} AND deleted_at IS NULL
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async findAccountUserId(
    provider: string,
    providerUserId: string
  ): Promise<string | null> {
    const rows = await this.db.query(sql<{ user_id: string }>`
      SELECT user_id
      FROM idp_accounts
      WHERE provider = ${provider}
        AND provider_user_id = ${providerUserId}
        AND deleted_at IS NULL
      LIMIT 1
    `);
    return rows[0]?.user_id ?? null;
  }

  async upsertSocialUser(args: {
    readonly provider: string;
    readonly providerUserId: string;
    readonly email: string | null;
    readonly name: string | null;
    readonly image: string | null;
    readonly accessToken?: string | null;
    readonly refreshToken?: string | null;
  }): Promise<IdpUserRow> {
    const existingUserId = await this.findAccountUserId(
      args.provider,
      args.providerUserId
    );
    const now = isoFromMs(this.clock.now());
    if (existingUserId !== null) {
      await this.db.run(sql`
        UPDATE idp_users
        SET email = ${args.email},
            name = ${args.name},
            image = ${args.image},
            updated_at = ${now}
        WHERE id = ${existingUserId}
      `);
      await this.db.run(sql`
        UPDATE idp_accounts
        SET access_token = ${args.accessToken ?? null},
            refresh_token = ${args.refreshToken ?? null},
            updated_at = ${now}
        WHERE provider = ${args.provider}
          AND provider_user_id = ${args.providerUserId}
      `);
      const user = await this.findUserById(existingUserId);
      if (user === null) {
        throw new Error('idp user missing after upsert');
      }
      return user;
    }

    const userId = this.createId();
    const accountId = this.createId();
    await this.db.run(sql`
      INSERT INTO idp_users (id, created_at, updated_at, email, name, image)
      VALUES (
        ${userId}, ${now}, ${now},
        ${args.email}, ${args.name}, ${args.image}
      )
    `);
    await this.db.run(sql`
      INSERT INTO idp_accounts (
        id, created_at, updated_at, user_id, provider, provider_user_id,
        access_token, refresh_token
      )
      VALUES (
        ${accountId}, ${now}, ${now}, ${userId}, ${args.provider},
        ${args.providerUserId}, ${args.accessToken ?? null},
        ${args.refreshToken ?? null}
      )
    `);
    return {
      id: userId,
      email: args.email,
      name: args.name,
      image: args.image,
    };
  }

  async createSession(userId: string): Promise<{
    readonly token: string;
    readonly expiresAtMs: number;
  }> {
    const token = this.createId();
    const expiresAtMs = this.clock.now() + AUTH_SESSION_TTL_MS;
    const now = isoFromMs(this.clock.now());
    const expiresAt = isoFromMs(expiresAtMs);
    const tokenHash = hashAuthSecret(this.secret, token);
    await this.db.run(sql`
      INSERT INTO idp_sessions (
        id, created_at, updated_at, user_id, token_hash, expires_at
      )
      VALUES (
        ${this.createId()}, ${now}, ${now}, ${userId},
        ${tokenHash}, ${expiresAt}
      )
    `);
    return { token, expiresAtMs };
  }

  async findSessionByToken(token: string): Promise<{
    readonly session: IdpSessionRow;
    readonly user: IdpUserRow;
  } | null> {
    const tokenHash = hashAuthSecret(this.secret, token);
    const rows = await this.db.query(sql<{
      id: string;
      user_id: string;
      token_hash: string;
      expires_at: string;
      email: string | null;
      name: string | null;
      image: string | null;
    }>`
      SELECT s.id, s.user_id, s.token_hash, s.expires_at,
             u.email, u.name, u.image
      FROM idp_sessions s
      INNER JOIN idp_users u ON u.id = s.user_id
      WHERE s.token_hash = ${tokenHash}
        AND s.deleted_at IS NULL
        AND u.deleted_at IS NULL
      LIMIT 1
    `);
    const row = rows[0];
    if (row === undefined) return null;
    const expiresMs = Date.parse(row.expires_at);
    if (!Number.isFinite(expiresMs) || expiresMs <= this.clock.now()) {
      return null;
    }
    return {
      session: {
        id: row.id,
        user_id: row.user_id,
        token_hash: row.token_hash,
        expires_at: row.expires_at,
      },
      user: {
        id: row.user_id,
        email: row.email,
        name: row.name,
        image: row.image,
      },
    };
  }

  async deleteSessionByToken(token: string): Promise<void> {
    const tokenHash = hashAuthSecret(this.secret, token);
    await this.db.run(sql`
      DELETE FROM idp_sessions WHERE token_hash = ${tokenHash}
    `);
  }

  async createOauthState(args: {
    readonly provider: string;
    readonly callbackUrl: string;
  }): Promise<{
    readonly state: string;
    readonly codeVerifier: string;
  }> {
    const state = this.createId();
    const codeVerifier = pkceCodeVerifier(this.createId());
    const now = isoFromMs(this.clock.now());
    const expiresAt = isoFromMs(this.clock.now() + AUTH_OAUTH_STATE_TTL_MS);
    await this.db.run(sql`
      INSERT INTO idp_oauth_states (
        id, created_at, updated_at, provider, state, code_verifier,
        callback_url, exchange_code_hash, expires_at, user_id
      )
      VALUES (
        ${this.createId()}, ${now}, ${now}, ${args.provider}, ${state},
        ${codeVerifier}, ${args.callbackUrl}, ${null}, ${expiresAt}, ${null}
      )
    `);
    return { state, codeVerifier };
  }

  async findOauthStateByState(state: string): Promise<{
    readonly id: string;
    readonly provider: string;
    readonly code_verifier: string;
    readonly callback_url: string;
    readonly expires_at: string;
  } | null> {
    const rows = await this.db.query(sql<{
      id: string;
      provider: string;
      code_verifier: string;
      callback_url: string;
      expires_at: string;
    }>`
      SELECT id, provider, code_verifier, callback_url, expires_at
      FROM idp_oauth_states
      WHERE state = ${state} AND deleted_at IS NULL
      LIMIT 1
    `);
    const row = rows[0];
    if (row === undefined) return null;
    const expiresMs = Date.parse(row.expires_at);
    if (!Number.isFinite(expiresMs) || expiresMs <= this.clock.now()) {
      return null;
    }
    return row;
  }

  async attachExchangeCode(args: {
    readonly stateId: string;
    readonly userId: string;
  }): Promise<string> {
    const code = this.createId();
    const codeHash = hashAuthSecret(this.secret, code);
    const now = isoFromMs(this.clock.now());
    const expiresAt = isoFromMs(this.clock.now() + AUTH_OAUTH_STATE_TTL_MS);
    await this.db.run(sql`
      UPDATE idp_oauth_states
      SET exchange_code_hash = ${codeHash},
          user_id = ${args.userId},
          expires_at = ${expiresAt},
          updated_at = ${now},
          state = ${`${args.stateId}:used:${this.createId()}`}
      WHERE id = ${args.stateId}
    `);
    return code;
  }

  async consumeExchangeCode(code: string): Promise<string | null> {
    const codeHash = hashAuthSecret(this.secret, code);
    const rows = await this.db.query(sql<{
      id: string;
      user_id: string | null;
      expires_at: string;
    }>`
      SELECT id, user_id, expires_at
      FROM idp_oauth_states
      WHERE exchange_code_hash = ${codeHash} AND deleted_at IS NULL
      LIMIT 1
    `);
    const row = rows[0];
    if (row === undefined || row.user_id === null) return null;
    const expiresMs = Date.parse(row.expires_at);
    if (!Number.isFinite(expiresMs) || expiresMs <= this.clock.now()) {
      return null;
    }
    await this.db.run(sql`
      DELETE FROM idp_oauth_states WHERE id = ${row.id}
    `);
    return row.user_id;
  }

  async listAccounts(userId: string): Promise<
    readonly {
      readonly id: string;
      readonly provider: string;
      readonly provider_user_id: string;
    }[]
  > {
    return this.db.query(sql<{
      id: string;
      provider: string;
      provider_user_id: string;
    }>`
      SELECT id, provider, provider_user_id
      FROM idp_accounts
      WHERE user_id = ${userId} AND deleted_at IS NULL
    `);
  }

  async listDevAccounts(): Promise<
    readonly {
      readonly provider_user_id: string;
      readonly name: string | null;
      readonly email: string | null;
    }[]
  > {
    return this.db.query(sql<{
      provider_user_id: string;
      name: string | null;
      email: string | null;
    }>`
      SELECT a.provider_user_id, u.name, u.email
      FROM idp_accounts a
      INNER JOIN idp_users u ON u.id = a.user_id
      WHERE a.provider = 'dev'
        AND a.deleted_at IS NULL
        AND u.deleted_at IS NULL
      ORDER BY a.provider_user_id
    `);
  }

  async attachProviderAuthCode(args: {
    readonly oauthStateId: string;
    readonly authCode: string;
    readonly providerUserId: string;
  }): Promise<void> {
    const codeHash = hashAuthSecret(this.secret, args.authCode);
    const now = isoFromMs(this.clock.now());
    const expiresAt = isoFromMs(this.clock.now() + AUTH_OAUTH_STATE_TTL_MS);
    await this.db.run(sql`
      INSERT INTO idp_provider_auth_codes (
        id, created_at, updated_at, oauth_state_id, code_hash,
        provider_user_id, expires_at
      )
      VALUES (
        ${this.createId()}, ${now}, ${now}, ${args.oauthStateId},
        ${codeHash}, ${args.providerUserId}, ${expiresAt}
      )
    `);
  }

  async consumeProviderAuthCode(args: {
    readonly authCode: string;
    readonly oauthStateId: string;
  }): Promise<string | null> {
    const codeHash = hashAuthSecret(this.secret, args.authCode);
    const rows = await this.db.query(sql<{
      id: string;
      provider_user_id: string;
      expires_at: string;
    }>`
      SELECT id, provider_user_id, expires_at
      FROM idp_provider_auth_codes
      WHERE code_hash = ${codeHash}
        AND oauth_state_id = ${args.oauthStateId}
        AND deleted_at IS NULL
      LIMIT 1
    `);
    const row = rows[0];
    if (row === undefined) return null;
    const expiresMs = Date.parse(row.expires_at);
    if (!Number.isFinite(expiresMs) || expiresMs <= this.clock.now()) {
      return null;
    }
    await this.db.run(sql`
      DELETE FROM idp_provider_auth_codes WHERE id = ${row.id}
    `);
    return row.provider_user_id;
  }
}
