import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import type { WriteContext } from '@pkgs/write/shared/write-context';
import { WriteError } from '@pkgs/write/shared/write-result';

import { joinSpaceWrite } from '../../shared/join-space/join-space-write';
import {
  joinSpaceRemote,
  type SpacesClientDeps,
} from '../spaces-actions';

/**
 * Local join may lack invite/friendship rows; REST validates invite/private
 * until invites fully sync (temporary).
 */
const JOIN_REST_FALLBACK_CODES = new Set([
  'SPACE_NOT_FOUND',
  'SPACE_VISIBILITY_DENIED',
  'SPACE_INVITE_INVALID',
  'SPACE_NOT_SIGNED_IN',
]);

async function hasLocalSpaceRow(
  sql: SqlClient,
  spaceId: string
): Promise<boolean> {
  const rows = await sql.query<{ readonly id: string }>(
    `SELECT ${SpaceCol.id} AS id
     FROM ${SPACES_TABLE.tableName}
     WHERE ${SpaceCol.id} = ?
     LIMIT 1`,
    [spaceId]
  );
  return rows[0] !== undefined;
}

export async function joinSpaceAction(
  sql: SqlClient,
  writeContext: WriteContext,
  deps: SpacesClientDeps,
  args: {
    readonly spaceId: string;
    readonly deviceLabel: string;
    readonly inviteToken: string | null;
  }
): Promise<void> {
  const local = await hasLocalSpaceRow(sql, args.spaceId);
  if (!local) {
    await joinSpaceRemote(deps, args);
    return;
  }
  try {
    await runClientWrite(
      joinSpaceWrite,
      writeContext,
      args,
      sql
    );
  } catch (error: unknown) {
    if (
      error instanceof WriteError &&
      JOIN_REST_FALLBACK_CODES.has(error.code)
    ) {
      await joinSpaceRemote(deps, args);
      return;
    }
    throw error;
  }
}
