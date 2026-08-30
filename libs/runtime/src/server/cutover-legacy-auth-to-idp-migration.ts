import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { sql, unsafe } from '@pkgs/sql';

/**
 * Cutover from Better Auth tables to isomorphic IdP tables.
 * Allowlisted for better-auth vocabulary (table/provider names only).
 *
 * If `better_auth_user` exists: copy users/accounts into `idp_*` preserving
 * ids, remap `auth_external_accounts.provider` from `better-auth` → `idp`,
 * then drop all `better_auth_*` tables.
 */
export class CutoverLegacyAuthToIdpMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    const exists = await ctx.sqlClient.query(sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'better_auth_user'
      ) AS exists
    `);
    if (exists[0]?.exists !== true) {
      ctx.logger.info('better_auth_user absent; skip IdP cutover');
      return;
    }

    ctx.logger.info('cutting over better_auth_* → idp_*');

    await ctx.sqlClient.run(
      unsafe(`
      INSERT INTO idp_users (id, created_at, updated_at, deleted_at, email, name, image)
      SELECT
        id,
        COALESCE("createdAt", NOW()),
        COALESCE("updatedAt", NOW()),
        NULL,
        email,
        name,
        image
      FROM better_auth_user
      ON CONFLICT (id) DO NOTHING
    `)
    );

    await ctx.sqlClient.run(
      unsafe(`
      INSERT INTO idp_accounts (
        id, created_at, updated_at, deleted_at,
        user_id, provider, provider_user_id, access_token, refresh_token
      )
      SELECT
        id,
        COALESCE("createdAt", NOW()),
        COALESCE("updatedAt", NOW()),
        NULL,
        "userId",
        "providerId",
        "accountId",
        "accessToken",
        "refreshToken"
      FROM better_auth_account
      ON CONFLICT (id) DO NOTHING
    `)
    );

    await ctx.sqlClient.run(sql`
      UPDATE auth_external_accounts
      SET provider = 'idp'
      WHERE provider = 'better-auth'
    `);

    for (const name of [
      'better_auth_verification',
      'better_auth_session',
      'better_auth_account',
      'better_auth_user',
    ] as const) {
      await ctx.sqlClient.run(
        unsafe(`DROP TABLE IF EXISTS ${quoteIdent(name)} CASCADE`)
      );
    }

    ctx.logger.info('better_auth_* cutover complete');
  }
}

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`invalid table name for DROP: ${name}`);
  }
  return `"${name}"`;
}
