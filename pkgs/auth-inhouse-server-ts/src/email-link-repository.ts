/**
 * Emailed sign-in links (`idp_email_links`) and how often an address asks
 * for one (`idp_email_link_attempts`). A link's token is a bearer secret:
 * minted from the id port like every other token here, stored only as a
 * peppered hash, and spent by exactly one confirm.
 */

import {
  AUTH_EMAIL_LINK_REQUEST_LIMIT,
  AUTH_EMAIL_LINK_TTL_MS,
  AUTH_EMAIL_LINK_WINDOW_MS,
} from '@pkgs/auth-inhouse-shared-ts/auth-constants';
import { hashAuthSecret } from '@pkgs/auth-inhouse-shared-ts/token-hash';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import { isLive, isoFromMs } from './idp-repository';

export type SpentEmailLink = {
  /** The address the link was mailed to: the mailbox its opener controls. */
  readonly email: string;
  /** The pending link this sign-in was asked to prove, if any. */
  readonly pendingLinkId: string | null;
};

type LinkRow = {
  readonly email: string;
  readonly pending_link_id: string | null;
  readonly expires_at: string;
};

export class EmailLinkRepository {
  constructor(
    private readonly db: SqlTx,
    private readonly deps: {
      readonly clock: Clock;
      readonly createId: CreateId;
      readonly secret: string;
    }
  ) {}

  /**
   * Count one request against the address's window. The database serializes
   * the count across replicas; `false` once the address is over its limit.
   */
  async admit(email: string): Promise<boolean> {
    const nowMs = this.deps.clock.now();
    const now = isoFromMs(nowMs);
    const cutoff = isoFromMs(nowMs - AUTH_EMAIL_LINK_WINDOW_MS);
    const id = hashAuthSecret(this.deps.secret, `email-link-attempt:${email}`);
    const rows = await this.db.query(sql<{ attempts: unknown }>`
      INSERT INTO idp_email_link_attempts (id, created_at, updated_at, window_started_at, attempts)
      VALUES (${id}, ${now}, ${now}, ${now}, 1)
      ON CONFLICT (id) DO UPDATE SET
        attempts = CASE WHEN idp_email_link_attempts.window_started_at <= ${cutoff} THEN 1 ELSE idp_email_link_attempts.attempts + 1 END,
        window_started_at = CASE WHEN idp_email_link_attempts.window_started_at <= ${cutoff} THEN ${now} ELSE idp_email_link_attempts.window_started_at END,
        updated_at = ${now}
      RETURNING attempts
    `);
    const attempts = Number(rows[0]?.attempts ?? Number.POSITIVE_INFINITY);
    return attempts <= AUTH_EMAIL_LINK_REQUEST_LIMIT;
  }

  /** Mint a link for `email`, dropping the address's links that have lapsed. */
  async mint(args: {
    readonly email: string;
    readonly pendingLinkId: string | null;
  }): Promise<{ readonly token: string; readonly expiresAtMs: number }> {
    const token = this.deps.createId();
    const nowMs = this.deps.clock.now();
    const now = isoFromMs(nowMs);
    const expiresAtMs = nowMs + AUTH_EMAIL_LINK_TTL_MS;
    await this.db.run(sql`
      DELETE FROM idp_email_links
      WHERE email = ${args.email} AND expires_at <= ${now}
    `);
    await this.db.run(sql`
      INSERT INTO idp_email_links (
        id, created_at, updated_at, token_hash, email, pending_link_id,
        expires_at, consumed_at
      )
      VALUES (
        ${this.deps.createId()}, ${now}, ${now},
        ${hashAuthSecret(this.deps.secret, token)}, ${args.email},
        ${args.pendingLinkId}, ${isoFromMs(expiresAtMs)}, ${null}
      )
    `);
    return { token, expiresAtMs };
  }

  /**
   * Spend a link. The update is the claim: of any number of confirms racing
   * on one token, the database lets exactly one mark it consumed. `null` for
   * a token that is unknown, already spent, or past its window.
   */
  async consume(token: string): Promise<SpentEmailLink | null> {
    const nowMs = this.deps.clock.now();
    const now = isoFromMs(nowMs);
    const rows = await this.db.query(sql<LinkRow>`
      UPDATE idp_email_links
      SET consumed_at = ${now}, updated_at = ${now}
      WHERE token_hash = ${hashAuthSecret(this.deps.secret, token)}
        AND consumed_at IS NULL
        AND deleted_at IS NULL
      RETURNING email, pending_link_id, expires_at
    `);
    const row = rows[0];
    if (row === undefined || !isLive(row.expires_at, nowMs)) return null;
    return { email: row.email, pendingLinkId: row.pending_link_id };
  }
}
