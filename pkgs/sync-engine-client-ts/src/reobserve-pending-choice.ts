import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { canonicalJson } from '@pkgs/sync-engine-shared-ts/canonical';
import type { Mutation } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { parseStandardSchema } from '@pkgs/sync-engine-shared-ts/standard-schema';

/** Reopening an identical uncertain choice observes its durable original identity. */
export async function reobservePendingChoice(args: {
  readonly db: SqlClient;
  readonly clientId: string;
  readonly mutation: Pick<Mutation<unknown>, 'name' | 'args' | 'pendingUx'>;
  readonly value: unknown;
}): Promise<string | null> {
  if (args.mutation.pendingUx !== 'pending') return null;
  const parsed = await parseStandardSchema(args.mutation.args, args.value);
  if (!parsed.ok) return null;
  const pending = await args.db.query(sql<{
    readonly id: string;
    readonly args: string;
    readonly deleted_at: string | null;
  }>`
    SELECT id, args, deleted_at FROM sync_engine_mutations
    WHERE client_id = ${args.clientId} AND name = ${args.mutation.name}
    ORDER BY seq DESC LIMIT 1
  `);
  const expected = canonicalJson(parsed.value);
  const choice = pending[0];
  return choice !== undefined &&
    choice.deleted_at === null &&
    canonicalJson(JSON.parse(choice.args)) === expected
    ? choice.id
    : null;
}
