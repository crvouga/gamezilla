/**
 * Stored spaces rows as a world of `specs/spaces/spaces.als`. The same SQL
 * reads the server's database and a device's copy; only live rows count
 * (a tombstoned space or friendship is not in the world).
 *
 * - `OpenSpace` / `EndedSpace`: a live space row, split on `ended_at`.
 * - `host`: the space's host member (`host_member_id`, else
 *   `host_account_id`), the product's own rule for who hosts it.
 * - `friend`: live friendships, both ways.
 * - `presence` — NOT STORED, pinned empty: who is in a space right now is
 *   the room's live roster, held in the room server's memory and never
 *   persisted. The nearest stored rows, each device's open sessions
 *   (`spaces_open_sessions`), are not presence: stepping out keeps a device's
 *   session (the space stays open on it) while presence drops the person,
 *   and dropping out is a connection fact storage never sees. Projecting
 *   sessions as presence would make up who is in which space, so a stored
 *   snapshot holds no presence and the facts about presence
 *   (`NobodyInAnEndedSpace`, `InOneSpaceAtATime`) are left to the Quint
 *   model, which observes presence live.
 * - `lobby` — DERIVED, NOT STORED: a lobby is a query, not a row. It is
 *   computed per person with the product's own lobby query (the one the
 *   Spaces screen runs, `sharedLiveSpaceIdsSql`), on the same store — on a
 *   device, for everyone it knows of, from its own copy of the rows.
 */

import { sharedLiveSpaceIdsSql } from '@libs/spaces/root/client/my-live-space-seat-sql';
import { sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';

import { friendsRows } from './friendships-projection';
import type { Names, World } from './snapshot-worlds';
import {
  bothWays,
  named,
  type Pair,
  sortedSet,
  storedPeople,
} from './stored-people';

type SpaceRow = {
  readonly id: string;
  readonly ended_at: unknown;
  readonly host_member_id: string | null;
  readonly host_account_id: string | null;
};

async function spaceRows(db: SqlTx): Promise<readonly SpaceRow[]> {
  return db.query(sql<SpaceRow>`
    SELECT id, ended_at, host_member_id, host_account_id FROM spaces
    WHERE deleted_at IS NULL`);
}

function hostOf(space: SpaceRow): readonly Pair[] {
  const host = space.host_member_id ?? space.host_account_id;
  return host === null ? [] : [[space.id, host]];
}

async function lobbies(
  db: SqlTx,
  people: readonly string[]
): Promise<readonly Pair[]> {
  const lobby: Pair[] = [];
  for (const person of people) {
    const rows = await db.query(sharedLiveSpaceIdsSql({ memberId: person }));
    for (const row of rows) lobby.push([person, row.id]);
  }
  return lobby;
}

export async function projectSpaces(db: SqlTx, names: Names): Promise<World> {
  const spaces = await spaceRows(db);
  const friendships = (await friendsRows(db)).friendships;
  const hosts = spaces.flatMap(hostOf);
  const people = sortedSet([
    ...(await storedPeople(db)),
    ...friendships.flat(),
    ...hosts.map(([, host]) => host),
  ]);
  const isOpen = (space: SpaceRow) =>
    space.ended_at === null || space.ended_at === undefined;
  return {
    atoms: {
      Person: sortedSet(people.map(names)),
      OpenSpace: sortedSet(spaces.filter(isOpen).map((s) => names(s.id))),
      EndedSpace: sortedSet(
        spaces.filter((s) => !isOpen(s)).map((s) => names(s.id))
      ),
    },
    relations: {
      friend: named(bothWays(friendships), names),
      lobby: named(await lobbies(db, people), names),
      host: named(hosts, names),
      presence: [],
    },
  };
}
