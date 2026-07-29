import { beforeEach, describe, expect, test } from 'bun:test';

import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import { spaceMembershipEntityId } from '@libs/spaces/shared/participation/participation-ids';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { honey, sql, ident } from '@pkgs/sql';

import { endLiveSpacesWithoutActiveHostSeat } from '../shared/repair-live-spaces-without-host-seat';

const SPACE_ORPHAN = 'space-orphan';
const SPACE_OK = 'space-ok';
const ACCOUNT = 'account-1';
const GUEST = 'account-guest';

async function migrate(db: SqlClient): Promise<void> {
  await db.run(sql`CREATE TABLE ${ident(SPACES_TABLE.tableName)} (
      ${ident(SpaceCol.id)} TEXT PRIMARY KEY,
      ${ident(SpaceCol.title)} TEXT,
      ${ident(SpaceCol.hostId)} TEXT,
      ${ident(SpaceCol.createdAt)} TEXT,
      ${ident(SpaceCol.endedAt)} TEXT,
      ${ident(SpaceCol.visibility)} TEXT,
      ${ident(SpaceCol.hostAccountId)} TEXT,
      ${ident(SpaceCol.hostMemberId)} TEXT,
      ${ident(SpaceCol.activeMemberCount)} INTEGER NOT NULL DEFAULT 0
    )`);
  await db.run(sql`CREATE TABLE ${ident(SPACE_MEMBERSHIPS_TABLE.tableName)} (
      ${ident(SpaceMembershipCol.id)} TEXT PRIMARY KEY,
      ${ident(SpaceMembershipCol.memberId)} TEXT,
      ${ident(SpaceMembershipCol.spaceId)} TEXT,
      ${ident(SpaceMembershipCol.joinedAt)} TEXT,
      ${ident(SpaceMembershipCol.leftAt)} TEXT,
      ${ident(SpaceMembershipCol.profileId)} TEXT
    )`);
}

describe('endLiveSpacesWithoutActiveHostSeat', () => {
  let db: SqlClientImplBunSqlite;

  beforeEach(async () => {
    db = SqlClientImplBunSqlite.open(':memory:');
    await migrate(db);
  });

  test('ends live spaces whose host membership has left_at', async () => {
    await db.run(
      honey({
        insertInto: SPACES_TABLE.tableName,
        values: {
          [SpaceCol.id]: SPACE_ORPHAN,
          [SpaceCol.hostId]: 'device-1',
          [SpaceCol.hostMemberId]: ACCOUNT,
          [SpaceCol.hostAccountId]: ACCOUNT,
          [SpaceCol.visibility]: 'public',
          [SpaceCol.endedAt]: null,
          [SpaceCol.activeMemberCount]: 1,
        },
      })
    );
    await db.run(
      honey({
        insertInto: SPACE_MEMBERSHIPS_TABLE.tableName,
        values: {
          [SpaceMembershipCol.id]: spaceMembershipEntityId(
            ACCOUNT,
            SPACE_ORPHAN
          ),
          [SpaceMembershipCol.memberId]: ACCOUNT,
          [SpaceMembershipCol.spaceId]: SPACE_ORPHAN,
          [SpaceMembershipCol.joinedAt]: '2026-01-01T00:00:00.000Z',
          [SpaceMembershipCol.leftAt]: '2026-01-02T00:00:00.000Z',
          [SpaceMembershipCol.profileId]: ACCOUNT,
        },
      })
    );
    await db.run(
      honey({
        insertInto: SPACE_MEMBERSHIPS_TABLE.tableName,
        values: {
          [SpaceMembershipCol.id]: spaceMembershipEntityId(GUEST, SPACE_ORPHAN),
          [SpaceMembershipCol.memberId]: GUEST,
          [SpaceMembershipCol.spaceId]: SPACE_ORPHAN,
          [SpaceMembershipCol.joinedAt]: '2026-01-01T00:00:00.000Z',
          [SpaceMembershipCol.leftAt]: null,
          [SpaceMembershipCol.profileId]: GUEST,
        },
      })
    );

    await db.run(
      honey({
        insertInto: SPACES_TABLE.tableName,
        values: {
          [SpaceCol.id]: SPACE_OK,
          [SpaceCol.hostId]: 'device-1',
          [SpaceCol.hostMemberId]: ACCOUNT,
          [SpaceCol.hostAccountId]: ACCOUNT,
          [SpaceCol.visibility]: 'private',
          [SpaceCol.endedAt]: null,
          [SpaceCol.activeMemberCount]: 1,
        },
      })
    );
    await db.run(
      honey({
        insertInto: SPACE_MEMBERSHIPS_TABLE.tableName,
        values: {
          [SpaceMembershipCol.id]: spaceMembershipEntityId(ACCOUNT, SPACE_OK),
          [SpaceMembershipCol.memberId]: ACCOUNT,
          [SpaceMembershipCol.spaceId]: SPACE_OK,
          [SpaceMembershipCol.joinedAt]: '2026-01-01T00:00:00.000Z',
          [SpaceMembershipCol.leftAt]: null,
          [SpaceMembershipCol.profileId]: ACCOUNT,
        },
      })
    );

    const endedAt = '2026-07-28T00:00:00.000Z';
    const n = await endLiveSpacesWithoutActiveHostSeat(db, endedAt);
    expect(n).toBe(1);

    const rows = await db.query<{
      readonly id: string;
      readonly ended_at: string | null;
    }>(
      honey({
        select: [SpaceCol.id, SpaceCol.endedAt],
        from: SPACES_TABLE.tableName,
        orderBy: [[SpaceCol.id, 'asc']],
      })
    );
    expect(rows).toEqual([
      { id: SPACE_OK, ended_at: null },
      { id: SPACE_ORPHAN, ended_at: endedAt },
    ]);
  });
});
