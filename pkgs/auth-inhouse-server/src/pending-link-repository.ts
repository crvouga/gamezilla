/**
 * Identities parked while the person proves the account their address
 * matched. The token is a bearer secret (hashed at rest) and single use.
 */

import type { Clock } from '@pkgs/clock-shared/types';
import sql from '@pkgs/sql-shared/sql';
import type { SqlTx } from '@pkgs/sql-client-shared/interface';
import type { CreateId } from '@pkgs/uuid-shared/create-id';

import { AUTH_PENDING_LINK_TTL_MS } from '@pkgs/auth-inhouse-shared/auth-constants';
import { hashAuthSecret } from '@pkgs/auth-inhouse-shared/token-hash';
import { isoFromMs } from './idp-repository';
import type { ProviderIdentity } from './provider-identity';

export type PendingLink = {
  readonly id: string;
  readonly targetUserId: string;
  readonly identity: ProviderIdentity;
};

type Row = {
  readonly id: string;
  readonly target_user_id: string;
  readonly identity: unknown;
  readonly expires_at: string;
};

function parseIdentity(raw: unknown): ProviderIdentity {
  const value = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
  return value as ProviderIdentity;
}

export class PendingLinkRepository {
  constructor(
    private readonly db: SqlTx,
    private readonly deps: {
      readonly clock: Clock;
      readonly createId: CreateId;
      readonly secret: string;
    }
  ) {}

  async create(args: {
    readonly targetUserId: string;
    readonly identity: ProviderIdentity;
  }): Promise<string> {
    const token = this.deps.createId();
    const nowMs = this.deps.clock.now();
    const now = isoFromMs(nowMs);
    await this.db.run(sql`
      INSERT INTO idp_pending_links (
        id, created_at, updated_at, token_hash, target_user_id, provider,
        provider_user_id, identity, expires_at
      )
      VALUES (
        ${this.deps.createId()}, ${now}, ${now},
        ${hashAuthSecret(this.deps.secret, token)}, ${args.targetUserId},
        ${args.identity.provider}, ${args.identity.providerUserId},
        ${JSON.stringify(args.identity)},
        ${isoFromMs(nowMs + AUTH_PENDING_LINK_TTL_MS)}
      )
    `);
    return token;
  }

  private live(row: Row | undefined): PendingLink | null {
    if (row === undefined) return null;
    const expiresMs = Date.parse(row.expires_at);
    if (!Number.isFinite(expiresMs) || expiresMs <= this.deps.clock.now()) {
      return null;
    }
    return {
      id: row.id,
      targetUserId: row.target_user_id,
      identity: parseIdentity(row.identity),
    };
  }

  async findByToken(token: string): Promise<PendingLink | null> {
    const rows = await this.db.query(sql<Row>`
      SELECT id, target_user_id, identity, expires_at FROM idp_pending_links
      WHERE token_hash = ${hashAuthSecret(this.deps.secret, token)}
      LIMIT 1
    `);
    return this.live(rows[0]);
  }

  async findById(id: string): Promise<PendingLink | null> {
    const rows = await this.db.query(sql<Row>`
      SELECT id, target_user_id, identity, expires_at FROM idp_pending_links
      WHERE id = ${id}
      LIMIT 1
    `);
    return this.live(rows[0]);
  }

  async consume(id: string): Promise<void> {
    await this.db.run(sql`DELETE FROM idp_pending_links WHERE id = ${id}`);
  }
}
