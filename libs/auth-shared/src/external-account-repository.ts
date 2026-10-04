import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import { managedInsertColumns } from '@pkgs/sync-engine-shared/managed-columns';
import type { CreateId } from '@pkgs/uuid-shared/create-id';

type UserIdRow = { readonly user_id: string };

export type ExternalAccountWriteArgs = {
  readonly userId: string;
  readonly provider: string;
  readonly externalId: string;
  readonly metadata?: Record<string, unknown>;
  readonly now: () => number;
  readonly createId: CreateId;
};

function parseMetadata(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return {};
}

export class ExternalAccountRepository {
  constructor(private readonly db: SqlTx) {}

  async findUserIdByProviderExternalId(
    provider: string,
    externalId: string
  ): Promise<string | null> {
    const rows = await this.db.query(sql<UserIdRow>`
      SELECT user_id
      FROM auth_external_accounts
      WHERE provider = ${provider}
        AND external_id = ${externalId}
      LIMIT 1
    `);
    const userId = rows[0]?.user_id;
    return typeof userId === 'string' && userId.length > 0 ? userId : null;
  }

  async readExternalAccountId(
    userId: string,
    provider: string
  ): Promise<string | null> {
    const rows = await this.db.query(sql<{ external_id: string | null }>`
      SELECT external_id
      FROM auth_external_accounts
      WHERE user_id = ${userId}
        AND provider = ${provider}
      LIMIT 1
    `);
    const externalId = rows[0]?.external_id;
    return typeof externalId === 'string' && externalId.length > 0
      ? externalId
      : null;
  }

  /**
   * The account's email, as its sign-in provider last reported it: the first
   * linked identity whose metadata carries one. `null` when none does.
   */
  async readAccountEmail(userId: string): Promise<string | null> {
    const rows = await this.db.query(sql<{ metadata: unknown }>`
      SELECT metadata
      FROM auth_external_accounts
      WHERE user_id = ${userId}
        AND deleted_at IS NULL
      ORDER BY created_at ASC
    `);
    for (const row of rows) {
      const email = parseMetadata(row.metadata)['email'];
      if (typeof email === 'string' && email.trim().length > 0) {
        return email.trim();
      }
    }
    return null;
  }

  async insertUser(args: {
    readonly userId: string;
    readonly now: () => number;
    readonly createId: CreateId;
    readonly createdAt?: string;
    readonly isAnon?: boolean;
  }): Promise<void> {
    const isAnon = args.isAnon ?? false;
    const managed = managedInsertColumns(args.createId, args.now, args.userId);
    const created = args.createdAt ?? managed.created_at;
    await this.db.run(sql<void>`
      INSERT INTO auth_users (id, created_at, updated_at, is_anon)
      VALUES (
        ${managed.id},
        ${created},
        ${managed.updated_at},
        ${isAnon}
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }

  /**
   * Upsert by `(provider, external_id)`. Updates metadata only — never reassigns
   * `user_id`. Ownership of an external identity is immutable once linked.
   */
  async upsertExternalAccount(args: ExternalAccountWriteArgs): Promise<void> {
    const id = `${args.provider}:${args.externalId}`;
    const managed = managedInsertColumns(args.createId, args.now, id);
    const metadataJson = JSON.stringify(args.metadata ?? {});
    await this.db.run(sql<void>`
      INSERT INTO auth_external_accounts (
        id,
        created_at,
        updated_at,
        user_id,
        provider,
        external_id,
        metadata
      )
      VALUES (
        ${managed.id},
        ${managed.created_at},
        ${managed.updated_at},
        ${args.userId},
        ${args.provider},
        ${args.externalId},
        ${metadataJson}
      )
      ON CONFLICT (provider, external_id) DO UPDATE SET
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
      WHERE auth_external_accounts.user_id = excluded.user_id
    `);
  }

  /**
   * Inserts a new external-account link, or adopts the existing owner when
   * `(provider, external_id)` is already taken. Never steals the link onto
   * `args.userId`.
   *
   * @returns The canonical `user_id` for this external identity (may differ
   *   from `args.userId` when another account already owns the link).
   */
  async insertExternalAccountOrGet(
    args: ExternalAccountWriteArgs
  ): Promise<string> {
    const id = `${args.provider}:${args.externalId}`;
    const managed = managedInsertColumns(args.createId, args.now, id);
    const metadataJson = JSON.stringify(args.metadata ?? {});
    await this.db.run(sql<void>`
      INSERT INTO auth_external_accounts (
        id,
        created_at,
        updated_at,
        user_id,
        provider,
        external_id,
        metadata
      )
      VALUES (
        ${managed.id},
        ${managed.created_at},
        ${managed.updated_at},
        ${args.userId},
        ${args.provider},
        ${args.externalId},
        ${metadataJson}
      )
      ON CONFLICT (provider, external_id) DO NOTHING
    `);
    const ownerId = await this.findUserIdByProviderExternalId(
      args.provider,
      args.externalId
    );
    if (ownerId === null) {
      throw new Error(
        `auth_external_accounts row missing after insert (${args.provider}/${args.externalId})`
      );
    }
    return ownerId;
  }

  async findUserIdByPrimaryAuthExternalId(
    primaryAuthProvider: string,
    externalUserId: string
  ): Promise<string | null> {
    return this.findUserIdByProviderExternalId(
      primaryAuthProvider,
      externalUserId
    );
  }
}

export async function readMetadataEmail(
  metadata: Record<string, unknown>
): Promise<string | null> {
  const email = metadata['email'];
  return typeof email === 'string' && email.length > 0 ? email : null;
}

export { parseMetadata };
