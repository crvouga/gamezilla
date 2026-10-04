/**
 * Runs the real friends mutations against an in-memory SQLite database, the
 * way the sync engine applies them locally (`wrapMutationDb` injects managed
 * columns and rejects hard deletes), and reads back the observable state.
 */
import { BILLING_TABLES } from '@libs/billing-shared/tables';
import { FRIENDS_TABLES } from '@libs/friends-shared/tables';
import { defineTable } from '@pkgs/db-schema-shared/define-table';
import { registerTables } from '@pkgs/db-schema-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { outboxDeliveries, outboxEvents } from '@pkgs/outbox-shared/tables';
import sql from '@pkgs/sql-shared/sql';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-server/impl-bun-sqlite';
import type { MutationDb, MutationEnv } from '@pkgs/sync-engine-shared/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { wrapMutationDb } from '@pkgs/sync-engine-shared/wrap-mutation-db';

/** Shape of client-config's synced table (the permission resolver reads it). */
const clientConfigFixture = defineTable({
  domain: 'client_config',
  name: 'client_config',
  columns: { value: 'json' },
});

export async function openFriendsDb(): Promise<SqlClient> {
  const db = SqlClientImplBunSqlite.openMemory();
  await reconcileSqliteSchema(
    db,
    registerTables([
      ...FRIENDS_TABLES,
      ...BILLING_TABLES,
      clientConfigFixture,
      outboxEvents,
      outboxDeliveries,
    ]),
    { ownership: 'declared-only' }
  );
  return db;
}

type ValidationResult = { readonly issues?: unknown; readonly value?: unknown };

/** The slice of a `defineMutation` definition this harness drives. */
export type RunnableMutation = {
  readonly args: {
    readonly '~standard': {
      validate(value: unknown): ValidationResult | Promise<ValidationResult>;
    };
  };
  run(
    ctx: { readonly tx: MutationDb; readonly env: MutationEnv },
    args: never
  ): Promise<void>;
};

let managedIdSeq = 0;

function signedInEnv(actorId: string, nowMs: number): MutationEnv {
  return {
    actorId,
    deviceId: `${actorId}-device`,
    accountId: actorId,
    isAnon: false,
    now: () => new Date(nowMs),
    createId: () => `managed-${++managedIdSeq}`,
  };
}

/** `'ok'` or the permanent `MutationError` code the mutation rejected with. */
export async function applyMutation(args: {
  readonly db: SqlClient;
  readonly mutation: RunnableMutation;
  readonly actorId: string;
  readonly nowMs: number;
  readonly input: unknown;
}): Promise<string> {
  const mutation = args.mutation;
  const env = signedInEnv(args.actorId, args.nowMs);
  const parsed = await mutation.args['~standard'].validate(args.input);
  if (parsed.issues !== undefined) {
    throw new Error(`invalid args: ${JSON.stringify(parsed.issues)}`);
  }
  const { tx } = wrapMutationDb(args.db, env);
  try {
    await mutation.run({ tx, env }, parsed.value as never);
    return 'ok';
  } catch (error) {
    if (error instanceof MutationError) return error.code;
    throw error;
  }
}

export type FriendsSnapshot = {
  readonly friendships: readonly string[];
  readonly requests: readonly string[];
  readonly blocks: readonly string[];
};

type FriendshipRow = {
  readonly id: string;
  readonly user_low: string;
  readonly user_high: string;
};

/** Live rows as sorted strings; asserts the canonical pair key on the way. */
export async function readSnapshot(db: SqlClient): Promise<FriendsSnapshot> {
  const friendships = await db.query(sql<FriendshipRow>`
    SELECT id, user_low, user_high FROM friends_friendships
    WHERE deleted_at IS NULL
  `);
  for (const row of friendships) {
    if (!(row.user_low < row.user_high)) {
      throw new Error(`non-canonical pair ${row.user_low}/${row.user_high}`);
    }
    if (row.id !== `${row.user_low}:${row.user_high}`) {
      throw new Error(`friendship id ${row.id} is not its pair key`);
    }
  }
  const requests = await db.query(
    sql<{
      readonly id: string;
      readonly from_user_id: string;
      readonly to_user_id: string;
      readonly status: string;
    }>`SELECT id, from_user_id, to_user_id, status FROM friends_requests`
  );
  const blocks = await db.query(sql<{
    readonly blocker_id: string;
    readonly blocked_id: string;
  }>`
    SELECT blocker_id, blocked_id FROM friends_blocks WHERE deleted_at IS NULL
  `);
  return {
    friendships: friendships.map((r) => r.id).sort(),
    requests: requests
      .map((r) => `${r.id} ${r.from_user_id}>${r.to_user_id} ${r.status}`)
      .sort(),
    blocks: blocks.map((r) => `${r.blocker_id}>${r.blocked_id}`).sort(),
  };
}
