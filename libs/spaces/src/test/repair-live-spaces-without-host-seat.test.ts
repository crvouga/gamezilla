import { describe, expect, test } from 'bun:test';

import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

import { endLiveSpacesWithoutActiveHostSeat } from '../shared/repair-live-spaces-without-host-seat';

describe('endLiveSpacesWithoutActiveHostSeat', () => {
  test('is a no-op after membership seats were removed', async () => {
    const db = SqlClientImplBunSqlite.open(':memory:');
    expect(await endLiveSpacesWithoutActiveHostSeat(db)).toBe(0);
  });
});
