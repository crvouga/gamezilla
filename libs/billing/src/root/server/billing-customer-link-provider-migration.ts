import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { sql } from '@pkgs/sql';

/**
 * Customer links used to share one `billing` slot whatever provider minted
 * them; they are now keyed per provider (`billing:<provider>`), so a customer
 * id is only ever handed back to the provider that minted it. Every link in
 * the old slot was minted by Stripe — the only provider production billed
 * through — so it moves to `billing:stripe`. Idempotent: a second run finds
 * nothing in the old slot.
 */
export class BillingCustomerLinkProviderMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    await ctx.sqlClient.run(sql<void>`
      UPDATE auth_external_accounts
      SET provider = 'billing:stripe'
      WHERE provider = 'billing'
    `);
    ctx.logger.info('moved legacy billing customer links to billing:stripe');
  }
}
