import {
  AUTH_LINK_TICKET_TTL_MS,
  AUTH_OAUTH_STATE_TTL_MS,
  AUTH_SESSION_TTL_MS,
} from '@pkgs/auth-inhouse-shared/auth-constants';
import { pkceCodeVerifier } from '@pkgs/auth-inhouse-shared/pkce';
import { hashAuthSecret } from '@pkgs/auth-inhouse-shared/token-hash';
import type { Clock } from '@pkgs/clock-shared/types';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import { tagState } from './oauth-callback-relay';

export type IdpUserRow = {
  readonly id: string;
  readonly email: string | null;
  readonly name: string | null;
  readonly image: string | null;
};

export type IdpSessionRow = {
  readonly id: string;
  readonly created_at: string;
  readonly user_id: string;
  readonly token_hash: string;
  readonly expires_at: string;
};

/** What an OAuth round trip is for. */
export type OauthIntent = 'sign_in' | 'link';

export type OauthStateRow = {
  readonly id: string;
  readonly provider: string;
  readonly code_verifier: string;
  readonly callback_url: string;
  readonly expires_at: string;
  readonly intent: OauthIntent;
  readonly nonce: string;
  readonly link_user_id: string | null;
  readonly pending_link_id: string | null;
};

export function isoFromMs(ms: number): string {
  return new Date(ms).toISOString();
}

function isLive(expiresAt: string, nowMs: number): boolean {
  const expiresMs = Date.parse(expiresAt);
  return Number.isFinite(expiresMs) && expiresMs > nowMs;
}

/**
 * Users, sessions, OAuth round trips and link tickets. Identities live in
 * {@link IdentityRepository}. Transaction-scoped: callers hand it a `SqlTx`.
 */
export class IdpRepository {
  constructor(
    private readonly db: SqlTx,
    private readonly clock: Clock,
    private readonly createId: CreateId,
    private readonly secret: string
  ) {}

  private nowIso(): string {
    return isoFromMs(this.clock.now());
  }

  async findUserById(id: string): Promise<IdpUserRow | null> {
    const rows = await this.db.query(sql<IdpUserRow>`
      SELECT id, email, name, image
      FROM idp_users
      WHERE id = ${id} AND deleted_at IS NULL
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async insertUser(user: IdpUserRow): Promise<void> {
    const now = this.nowIso();
    await this.db.run(sql`
      INSERT INTO idp_users (id, created_at, updated_at, email, name, image)
      VALUES (
        ${user.id}, ${now}, ${now}, ${user.email}, ${user.name}, ${user.image}
      )
    `);
  }

  async updateUserProfile(user: IdpUserRow): Promise<void> {
    await this.db.run(sql`
      UPDATE idp_users
      SET email = ${user.email},
          name = ${user.name},
          image = ${user.image},
          updated_at = ${this.nowIso()}
      WHERE id = ${user.id}
    `);
  }

  async createSession(
    userId: string,
    lifetimeMs: number = AUTH_SESSION_TTL_MS
  ): Promise<{
    readonly token: string;
    readonly expiresAtMs: number;
  }> {
    if (!Number.isFinite(lifetimeMs) || lifetimeMs <= 0)
      throw new Error('Session lifetime must be positive');
    const token = this.createId();
    const expiresAtMs = this.clock.now() + lifetimeMs;
    const now = this.nowIso();
    const tokenHash = hashAuthSecret(this.secret, token);
    await this.db.run(sql`
      INSERT INTO idp_sessions (
        id, created_at, updated_at, user_id, token_hash, expires_at
      )
      VALUES (
        ${this.createId()}, ${now}, ${now}, ${userId},
        ${tokenHash}, ${isoFromMs(expiresAtMs)}
      )
    `);
    return { token, expiresAtMs };
  }

  async findSessionByToken(token: string): Promise<{
    readonly session: IdpSessionRow;
    readonly user: IdpUserRow;
  } | null> {
    const tokenHash = hashAuthSecret(this.secret, token);
    const rows = await this.db.query(sql<IdpSessionRow & IdpUserRow>`
      SELECT s.id, s.created_at, s.user_id, s.token_hash, s.expires_at,
             u.email, u.name, u.image
      FROM idp_sessions s
      INNER JOIN idp_users u ON u.id = s.user_id
      WHERE s.token_hash = ${tokenHash}
        AND s.deleted_at IS NULL
        AND u.deleted_at IS NULL
      LIMIT 1
    `);
    const row = rows[0];
    if (row === undefined || !isLive(row.expires_at, this.clock.now())) {
      return null;
    }
    return {
      session: {
        id: row.id,
        created_at: row.created_at,
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

  /** Sign a user out everywhere. */
  async deleteSessionsForUser(userId: string): Promise<void> {
    await this.db.run(sql`
      DELETE FROM idp_sessions WHERE user_id = ${userId}
    `);
  }

  async createOauthState(args: {
    readonly provider: string;
    readonly callbackUrl: string;
    readonly intent: OauthIntent;
    readonly linkUserId: string | null;
    readonly pendingLinkId: string | null;
    /** Prefix naming the deployment that owns the state (callback relay). */
    readonly stateTag: string | null;
  }): Promise<{
    readonly state: string;
    readonly codeVerifier: string;
    readonly nonce: string;
  }> {
    const state = tagState(args.stateTag, this.createId());
    const codeVerifier = pkceCodeVerifier(this.createId());
    const nonce = this.createId();
    const now = this.nowIso();
    const expiresAt = isoFromMs(this.clock.now() + AUTH_OAUTH_STATE_TTL_MS);
    await this.db.run(sql`
      INSERT INTO idp_oauth_states (
        id, created_at, updated_at, provider, state, code_verifier,
        callback_url, exchange_code_hash, expires_at, user_id, intent, nonce,
        link_user_id, pending_link_id
      )
      VALUES (
        ${this.createId()}, ${now}, ${now}, ${args.provider}, ${state},
        ${codeVerifier}, ${args.callbackUrl}, ${null}, ${expiresAt}, ${null},
        ${args.intent}, ${nonce}, ${args.linkUserId}, ${args.pendingLinkId}
      )
    `);
    return { state, codeVerifier, nonce };
  }

  async findOauthStateByState(state: string): Promise<OauthStateRow | null> {
    const rows = await this.db.query(sql<OauthStateRow>`
      SELECT id, provider, code_verifier, callback_url, expires_at,
             intent, nonce, link_user_id, pending_link_id
      FROM idp_oauth_states
      WHERE state = ${state} AND deleted_at IS NULL
      LIMIT 1
    `);
    const row = rows[0];
    if (row === undefined || !isLive(row.expires_at, this.clock.now())) {
      return null;
    }
    return { ...row, intent: row.intent === 'link' ? 'link' : 'sign_in' };
  }

  /** A state is single use: an error outcome burns it too. */
  async deleteOauthState(id: string): Promise<void> {
    await this.db.run(sql`DELETE FROM idp_oauth_states WHERE id = ${id}`);
  }

  async attachExchangeCode(args: {
    readonly stateId: string;
    readonly userId: string;
  }): Promise<string> {
    const code = this.createId();
    const codeHash = hashAuthSecret(this.secret, code);
    const expiresAt = isoFromMs(this.clock.now() + AUTH_OAUTH_STATE_TTL_MS);
    await this.db.run(sql`
      UPDATE idp_oauth_states
      SET exchange_code_hash = ${codeHash},
          user_id = ${args.userId},
          expires_at = ${expiresAt},
          updated_at = ${this.nowIso()},
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
    if (!isLive(row.expires_at, this.clock.now())) return null;
    await this.deleteOauthState(row.id);
    return row.user_id;
  }

  async createLinkTicket(args: {
    readonly userId: string;
    /** The bearer of the session asking to link. */
    readonly sessionToken: string;
  }): Promise<{
    readonly ticket: string;
    readonly expiresAtMs: number;
  }> {
    const ticket = this.createId();
    const expiresAtMs = this.clock.now() + AUTH_LINK_TICKET_TTL_MS;
    const now = this.nowIso();
    await this.db.run(sql`
      INSERT INTO idp_link_tickets (
        id, created_at, updated_at, token_hash, user_id, expires_at,
        session_token_hash
      )
      VALUES (
        ${this.createId()}, ${now}, ${now},
        ${hashAuthSecret(this.secret, ticket)}, ${args.userId},
        ${isoFromMs(expiresAtMs)},
        ${hashAuthSecret(this.secret, args.sessionToken)}
      )
    `);
    return { ticket, expiresAtMs };
  }

  /**
   * The user a ticket was minted for, once — and only while the minting
   * session is still live; `null` when unknown, stale, or orphaned.
   */
  async consumeLinkTicket(ticket: string): Promise<string | null> {
    const tokenHash = hashAuthSecret(this.secret, ticket);
    const rows = await this.db.query(sql<{
      id: string;
      user_id: string;
      expires_at: string;
      session_expires_at: string | null;
    }>`
      SELECT t.id, t.user_id, t.expires_at, s.expires_at AS session_expires_at
      FROM idp_link_tickets t
      LEFT JOIN idp_sessions s
        ON s.token_hash = t.session_token_hash
       AND s.user_id = t.user_id
       AND s.deleted_at IS NULL
      WHERE t.token_hash = ${tokenHash}
      LIMIT 1
    `);
    const row = rows[0];
    if (row === undefined) return null;
    await this.db.run(sql`DELETE FROM idp_link_tickets WHERE id = ${row.id}`);
    const nowMs = this.clock.now();
    const sessionLive =
      row.session_expires_at !== null && isLive(row.session_expires_at, nowMs);
    return isLive(row.expires_at, nowMs) && sessionLive ? row.user_id : null;
  }
}
