import type { Io } from '@pkgs/io';
import { sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';

export type ClientConfigStoredRow = {
  readonly id: string;
  readonly value: unknown;
  readonly deleted_at: string | null;
};

/** Layer C: transaction-scoped access to `client_config` rows. */
export class ClientConfigRepository {
  constructor(
    private readonly tx: SqlTx,
    private readonly io: Io
  ) {}

  async listAll(): Promise<readonly ClientConfigStoredRow[]> {
    return this.tx.query(sql<ClientConfigStoredRow>`
      SELECT id, value, deleted_at
      FROM client_config
    `);
  }

  async upsert(args: {
    readonly id: string;
    readonly value: unknown;
  }): Promise<void> {
    const nowIso = new Date(this.io.clock.now()).toISOString();
    const valueJson = JSON.stringify(args.value);
    await this.tx.run(sql<void>`
      INSERT INTO client_config (
        id,
        created_at,
        updated_at,
        deleted_at,
        value
      )
      VALUES (
        ${args.id},
        ${nowIso},
        ${nowIso},
        NULL,
        ${valueJson}
      )
      ON CONFLICT (id) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = EXCLUDED.updated_at,
        deleted_at = NULL
    `);
  }

  async softDelete(id: string): Promise<void> {
    const nowIso = new Date(this.io.clock.now()).toISOString();
    await this.tx.run(sql<void>`
      UPDATE client_config
      SET deleted_at = ${nowIso},
          updated_at = ${nowIso}
      WHERE id = ${id}
        AND deleted_at IS NULL
    `);
  }
}
