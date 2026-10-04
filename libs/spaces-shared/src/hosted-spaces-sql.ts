import type { Sql } from '@pkgs/sql-shared/sql';
import sql from '@pkgs/sql-shared/sql';

export type HostedCountRow = { readonly hosted: number | string };

/**
 * How many live spaces `memberId` hosts, leaving out `exceptSpaceId` (the
 * space being created, so a replay of the same create counts as before).
 * The hosting limit is decided against this, on the device and the server.
 */
export function liveHostedSpacesCountSql(args: {
  readonly memberId: string;
  readonly exceptSpaceId: string | null;
}): Sql<HostedCountRow> {
  return sql<HostedCountRow>`
    SELECT COUNT(*) AS hosted
    FROM spaces
    WHERE ended_at IS NULL
      AND deleted_at IS NULL
      AND (host_member_id = ${args.memberId} OR host_account_id = ${args.memberId})
      AND id <> ${args.exceptSpaceId ?? ''}
  `;
}
