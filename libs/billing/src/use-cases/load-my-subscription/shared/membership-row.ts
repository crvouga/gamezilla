/**
 * The actor's governing `billing_subscriptions` row, as the client reads it
 * locally. Booleans arrive as 0/1 from SQLite; every field may be blank on a
 * row a newer server wrote, so readers treat it as untrusted.
 */
export type MembershipRow = {
  readonly status: string | null;
  readonly price_key: string | null;
  readonly current_period_end: string | null;
  readonly cancel_at_period_end: number | boolean | null;
  /**
   * Provider credit in cents. Blank on a row written before credit was
   * projected; a number may arrive as text from Postgres. Never shown below 0.
   */
  readonly credit_cents?: number | string | null;
};
