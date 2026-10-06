import { CHESS_MULTIPLAYER_TABLES } from '@libs/chess-matchmaking-shared/multiplayer-tables';
import { openConformanceDb } from '@libs/permissions-shared/world';
import { PROFILE_TABLES } from '@libs/profile-shared/tables';
import { spaceUserEntityId } from '@libs/spaces-shared/participation-ids';
import { SPACES_TABLES } from '@libs/spaces-shared/tables';
import sql from '@pkgs/sql-root-shared/sql';

export const HOST = '6cd7d77a-023c-414a-90d3-e1b2b4908e2d';
export const DEVICE = '2e7a41ec-a2cc-4075-809e-b919b60d4b0d';
export const SPACE = 'friday-chess';
export const TOMBSTONE = '2026-10-05T11:42:24.881Z';

export async function openMultiplayerQueryFixture() {
  const db = await openConformanceDb([
    ...SPACES_TABLES,
    ...PROFILE_TABLES,
    ...CHESS_MULTIPLAYER_TABLES,
  ]);
  await db.run(sql`
    INSERT INTO spaces (id, host_id, host_member_id, deleted_at)
    VALUES (${SPACE}, ${DEVICE}, ${HOST}, ${null})`);
  await db.run(sql`
    INSERT INTO spaces_users (id, space_id, user_id, deleted_at)
    VALUES (${spaceUserEntityId(SPACE, 'watcher')}, ${SPACE}, ${'watcher'}, ${null})`);
  await db.run(sql`
    INSERT INTO chess_multiplayer_players (id, owner_id, game_id, deleted_at)
    VALUES (${'player'}, ${HOST}, ${'game'}, ${TOMBSTONE})`);
  await db.run(sql`
    INSERT INTO chess_multiplayer_games (id, white_id, black_id, deleted_at)
    VALUES (${'game'}, ${HOST}, ${'opponent'}, ${TOMBSTONE})`);
  await db.run(sql`
    INSERT INTO chess_opponent_searches (id, owner_id, deleted_at)
    VALUES (${'search'}, ${HOST}, ${TOMBSTONE})`);
  await db.run(sql`
    INSERT INTO profile (id, username, username_norm, avatar_config, deleted_at)
    VALUES (${'opponent'}, ${'Erased'}, ${'erased'}, ${'{}'}, ${TOMBSTONE})`);
  return db;
}
