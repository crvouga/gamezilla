import type { Logger } from '@pkgs/logger-shared/logger';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import sql from '@pkgs/sql-shared/sql';

/**
 * `obs_read` is created by `planetscale_neki_role.obs_read` in
 * libs/infra-shared/tofu/modules/database. The login name Neki issues may carry a
 * suffix, in which case this grant is skipped and `pg_read_all_data` still
 * covers SELECT. Foundation apply runs before reconcile, so the role exists
 * here on a deployed environment and is absent on a local database. Tables
 * are granted only after they exist.
 */
const OBS_READ_ROLE = 'obs_read';

type PresentRow = { readonly present: boolean | string };

export async function grantObsRead(
  sqlClient: SqlClient,
  logger: Logger
): Promise<void> {
  const rows = await sqlClient.query(sql<PresentRow>`
    SELECT EXISTS (
      SELECT 1 FROM pg_roles WHERE rolname = ${OBS_READ_ROLE}
    ) AS present
  `);
  if (!isPresent(rows[0]?.present)) {
    logger.info('obs_read is absent; skipping the read grant');
    return;
  }
  await sqlClient.run(sql`GRANT USAGE ON SCHEMA public TO obs_read`);
  await sqlClient.run(sql`GRANT SELECT ON profile TO obs_read`);
  await sqlClient.run(sql`GRANT SELECT ON idp_users TO obs_read`);
  await sqlClient.run(sql`GRANT SELECT ON idp_accounts TO obs_read`);
  logger.info('granted obs_read select on profile, idp_users and idp_accounts');
}

function isPresent(value: boolean | string | undefined): boolean {
  return value === true || value === 't' || value === 'true';
}
