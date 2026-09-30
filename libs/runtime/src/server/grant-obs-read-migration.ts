import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { sql } from '@pkgs/sql';

/**
 * `obs_read` is created by `planetscale_neki_role.obs_read` in
 * libs/infra/tofu/modules/database. The login name Neki issues may carry a
 * suffix, in which case this grant is skipped and `pg_read_all_data` still
 * covers SELECT. Foundation apply runs before migrations,
 * so the role exists here on a deployed environment and is absent on a local
 * database. Tables are granted only after they exist.
 */
const OBS_READ_ROLE = 'obs_read';

type PresentRow = { readonly present: boolean | string };

export class GrantObsReadMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    const rows = await ctx.sqlClient.query(sql<PresentRow>`
      SELECT EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = ${OBS_READ_ROLE}
      ) AS present
    `);
    if (!isPresent(rows[0]?.present)) {
      ctx.logger.info('obs_read is absent; skipping the read grant');
      return;
    }
    await grant(ctx);
    ctx.logger.info(
      'granted obs_read select on profile, idp_users and idp_accounts'
    );
  }
}

async function grant(ctx: DatabaseMigrationContext): Promise<void> {
  await ctx.sqlClient.run(sql`GRANT USAGE ON SCHEMA public TO obs_read`);
  await ctx.sqlClient.run(sql`GRANT SELECT ON profile TO obs_read`);
  await ctx.sqlClient.run(sql`GRANT SELECT ON idp_users TO obs_read`);
  await ctx.sqlClient.run(sql`GRANT SELECT ON idp_accounts TO obs_read`);
}

function isPresent(value: boolean | string | undefined): boolean {
  return value === true || value === 't' || value === 'true';
}
