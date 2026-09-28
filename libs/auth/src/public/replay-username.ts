import { OAUTH_PROVIDER_IDS } from '@pkgs/auth/shared';
import { join, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

type LinkedSubjectRow = {
  readonly subject: string | null;
};

/**
 * The username the identity layer proposes when profile's `ensureProfile`
 * replays on the server. It reads auth's own tables (the anonymous flag, the
 * linked sign-in subject), so profile asks here instead of reading them.
 *
 * Resolve the preferred username for this apply. The client handoff is
 * process-global, so in multi-actor hosts (harnesses, multi-app product-harness) one
 * actor's ensure can observe another actor's pending value. The server replay
 * is authoritative and deterministic instead:
 * - anonymous bootstraps, and accounts with no auth record yet, never consume
 *   it (their rows keep the auto name);
 * - when this account has a linked sign-in identity (its provider subject
 *   doubles as the harness actor username), that subject wins over any passed
 *   value (a foreign pending value is ignored);
 * - otherwise (email/create-account flow, no linked subject) the passed value
 *   stands, preserving legacy behavior.
 *
 * The subject comes from the synced sign-in method mirror
 * (`auth_external_accounts` rows keyed by `google` / `apple`), never from the
 * auth service's own storage. Before the mirror syncs, the passed value
 * stands; sync converges the row to the server's replayed state.
 */
export async function resolveReplayUsername(
  tx: Pick<SqlClient, 'query'>,
  userId: string,
  passed: string | undefined
): Promise<string | undefined> {
  const anon = await tx.query<{
    is_anon: boolean | number | string | null;
  }>(sql`
    SELECT is_anon
    FROM auth_users
    WHERE id = ${userId}
    LIMIT 1
  `);
  const flag = anon[0]?.is_anon;
  if (flag === true || flag === 1 || flag === '1' || flag === 't') {
    return undefined;
  }
  const rows = await tx.query<LinkedSubjectRow>(sql`
    SELECT external_id AS subject
    FROM auth_external_accounts
    WHERE user_id = ${userId}
      AND provider IN (${join(OAUTH_PROVIDER_IDS)})
      AND deleted_at IS NULL
    ORDER BY external_id ASC
    LIMIT 1
  `);
  const subject = rows[0]?.subject;
  return typeof subject === 'string' && subject.length > 0 ? subject : passed;
}
