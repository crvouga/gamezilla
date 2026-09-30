import type { Logger } from '@pkgs/logger';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

/**
 * `obs_read` is created by `neon_role.obs_read` in
 * libs/infra/tofu/modules/database. Foundation apply runs before reconcile,
 * so the role exists here on a deployed environment and is absent on a local
 * database. Tables are granted only after they exist.
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
