import { expect, test } from 'bun:test';
import { changeAvailability } from '@pkgs/matchmaking-sql-shared-ts/owner-repository';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';

// regression: matchmaking-availability-lock-then-update
test.each([true, false])(
  'availability %s locks and writes the owner in one statement',
  async (available) => {
    const statements: string[] = [];
    const tx: SqlTx = {
      query: async (query) => {
        statements.push(query.sql);
        return [{ current_id: 'search', available: true }] as never;
      },
      run: async (query) => {
        statements.push(query.sql);
        return { changes: 1, lastInsertRowid: 0 };
      },
    };
    await changeAvailability(tx, { ownerId: 'alice', available, nowMs: 1_000 });
    expect(
      statements.filter((query) => query.includes('matchmaking_owners'))
    ).toHaveLength(1);
    expect(statements).toHaveLength(available ? 1 : 2);
  }
);
