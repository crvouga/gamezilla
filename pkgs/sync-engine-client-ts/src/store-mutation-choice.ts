import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';

/** A saved local choice; completed refusals are never pending uploads. */
export type StoredMutationChoice = {
  readonly id: string;
  readonly name: string;
  readonly args: unknown;
  readonly clientId: string;
  readonly seq: number;
  readonly originTraceparent: string | null;
  readonly originSessionId: string | null;
  readonly originBuildSha: string | null;
  readonly createdAt: string;
  readonly deletedAt: string | null;
};

export async function storeMutationChoice(
  tx: SqlClient,
  choice: StoredMutationChoice
): Promise<void> {
  await tx.run(sql`
    INSERT INTO sync_engine_mutations (
      id, name, args, client_id, seq, origin_traceparent,
      origin_session_id, origin_build_sha,
      created_at, updated_at, deleted_at
    ) VALUES (
      ${choice.id}, ${choice.name}, ${JSON.stringify(choice.args)},
      ${choice.clientId}, ${choice.seq}, ${choice.originTraceparent},
      ${choice.originSessionId}, ${choice.originBuildSha},
      ${choice.createdAt}, ${choice.createdAt}, ${choice.deletedAt}
    )
  `);
}

export async function storeLocalRefusal(
  tx: SqlClient,
  choice: StoredMutationChoice,
  failure: { readonly code: string; readonly message: string }
): Promise<void> {
  await storeMutationChoice(tx, choice);
  await tx.run(sql`
    INSERT INTO sync_engine_write_rejections (
      id, mutation_id, client_id, code, message, meta,
      created_at, updated_at, deleted_at, acknowledged
    ) VALUES (
      ${`local:${choice.id}`}, ${choice.id}, ${choice.clientId},
      ${failure.code}, ${failure.message}, ${null},
      ${choice.createdAt}, ${choice.createdAt}, ${null}, ${0}
    )
  `);
}
