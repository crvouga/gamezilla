import { spaceRoomTopic } from '@libs/spaces-shared/space-room-topic';
import type { RoomServicePort } from '@pkgs/room-root-shared/room-service';
import sql from '@pkgs/sql-root-shared/sql';
import type { MutationDb } from '@pkgs/sync-engine-shared/mutations-types';
import {
  CustomGamesAttr,
  customGameActiveParticipant,
} from './custom-game-state';

/**
 * How many active Custom Games `person` takes part in, across the live spaces
 * they host or have joined. The rooms hold the games; the rows only say which
 * spaces to read.
 */
export async function activeCustomGamesOf(
  tx: Pick<MutationDb, 'query'>,
  rooms: Pick<RoomServicePort, 'read'>,
  person: string
): Promise<number> {
  const spaces = await tx.query(sql<{ readonly id: string }>`
    SELECT DISTINCT s.id FROM spaces s
    LEFT JOIN spaces_users u
      ON u.space_id = s.id AND u.user_id = ${person} AND u.deleted_at IS NULL
    WHERE s.deleted_at IS NULL AND s.ended_at IS NULL
      AND (s.host_member_id = ${person} OR u.id IS NOT NULL)
    ORDER BY s.id
  `);
  let active = 0;
  for (const space of spaces) {
    const games = CustomGamesAttr.from(
      await rooms.read(spaceRoomTopic(space.id))
    );
    if (customGameActiveParticipant(games, person)) active += 1;
  }
  return active;
}
