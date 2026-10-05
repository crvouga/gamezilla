import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';

import { governingRow } from './governing-row';

export type StoredMembership = {
  readonly provider: string;
  readonly status: string | null;
  readonly current_period_end: string | null;
};

/** Reads of the account's `billing_subscriptions` projection rows. */
export class MembershipRepository {
  constructor(private readonly tx: SqlTx) {}

  /** The row that governs the account, at whichever provider it is. */
  async governing(accountId: string): Promise<StoredMembership | null> {
    const rows = await this.tx.query(sql<StoredMembership>`
      SELECT provider, status, current_period_end
      FROM billing_subscriptions
      WHERE account_id = ${accountId}
        AND deleted_at IS NULL
      ORDER BY updated_at DESC
      LIMIT 50
    `);
    return governingRow(rows);
  }
}
