import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import { managedInsertColumns } from '@pkgs/sync-engine-shared/managed-columns';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import { pairId } from './pair-id';

function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function managedAtIso(createId: CreateId, nowIso: string, id?: string) {
  return managedInsertColumns(createId, () => new Date(nowIso).getTime(), id);
}

export class UserBlockRepository {
  constructor(private readonly tx: SqlTx) {}

  async isBlockedEitherDirection(
    userA: string,
    userB: string
  ): Promise<'none' | 'by_a' | 'by_b'> {
    const rows = await this.tx.query(sql<Record<string, unknown>>`
      SELECT blocker_id, blocked_id
      FROM friends_blocks
      WHERE deleted_at IS NULL
        AND (
          (blocker_id = ${userA} AND blocked_id = ${userB})
          OR (blocker_id = ${userB} AND blocked_id = ${userA})
        )
      LIMIT 1
    `);
    const row = rows[0];
    if (row === undefined) return 'none';
    const blockerId = readString(row, 'blocker_id');
    if (blockerId === userA) return 'by_a';
    return 'by_b';
  }

  async insert(
    blockerId: string,
    blockedId: string,
    now: string
  ): Promise<void> {
    await this.tx.run(sql<void>`
      INSERT INTO friends_blocks (id, blocker_id, blocked_id, created_at, deleted_at)
      VALUES (${pairId(blockerId, blockedId)}, ${blockerId}, ${blockedId}, ${now}, ${null})
      ON CONFLICT (blocker_id, blocked_id) DO UPDATE SET
        deleted_at = NULL,
        created_at = excluded.created_at
    `);
  }

  /** Insert with managed id/timestamps (server block path). */
  async insertManaged(
    blockerId: string,
    blockedId: string,
    now: string,
    createId: CreateId
  ): Promise<void> {
    const managed = managedAtIso(createId, now, pairId(blockerId, blockedId));
    await this.tx.run(sql<void>`
      INSERT INTO friends_blocks (
        id, blocker_id, blocked_id, created_at, updated_at, deleted_at
      )
      VALUES (
        ${managed.id},
        ${blockerId},
        ${blockedId},
        ${managed.created_at},
        ${managed.updated_at},
        ${null}
      )
      ON CONFLICT (blocker_id, blocked_id) DO UPDATE SET
        deleted_at = NULL,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    `);
  }

  async softDelete(
    blockerId: string,
    blockedId: string,
    now: string
  ): Promise<void> {
    await this.tx.run(sql<void>`
      UPDATE friends_blocks
      SET deleted_at = ${now}
      WHERE blocker_id = ${blockerId}
        AND blocked_id = ${blockedId}
        AND deleted_at IS NULL
    `);
  }

  /** Soft-delete and bump updated_at (server unblock path). */
  async delete(
    blockerId: string,
    blockedId: string,
    now: string
  ): Promise<void> {
    await this.tx.run(sql<void>`
      UPDATE friends_blocks
      SET deleted_at = ${now}, updated_at = ${now}
      WHERE blocker_id = ${blockerId}
        AND blocked_id = ${blockedId}
        AND deleted_at IS NULL
    `);
  }
}
