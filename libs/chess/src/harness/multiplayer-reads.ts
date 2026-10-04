import { actorUi } from '@libs/harness/system/actor-ui';
import type { ProductHarness } from '@libs/harness/system/harness';
import { accountIdOf, actorLocalSql } from '@libs/harness/system/identity';
import { asKeyword } from '@pkgs/keyword';
import { readCurrent } from '@pkgs/matchmaking-sql';
import { sql } from '@pkgs/sql';
import type { MultiplayerGame } from '../shared/multiplayer/game';

export async function multiplayerView(s: ProductHarness, actor: string) {
  const db = actorLocalSql(s, actor);
  const env = await s.harness.client(actor);
  const auth = env.createAuthClient().session.getSnapshot();
  if (auth.isHydrated && auth.session === null && auth.error === null)
    return { game: null, search: null };
  const owner = env.secureStorage.getValue(SESSION_TOKEN_KEY)
    ? env.secureStorage.getValue(LAST_LOCAL_ACCOUNT_ID_KEY)
    : null;
  if (db === null || owner === null) return { game: null, search: null };
  const games =
    await db.query(sql<MultiplayerGame>`SELECT g.id, g.white_id, g.black_id, g.fen,
    g.pgn, g.revision, g.turn, g.outcome, g.reason FROM chess_multiplayer_games AS g
    JOIN chess_multiplayer_players AS p ON p.game_id = g.id
    WHERE p.owner_id = ${owner} AND p.deleted_at IS NULL AND g.deleted_at IS NULL
      AND (g.white_id = ${owner} OR g.black_id = ${owner})`);
  const searches = await db.query(sql<{
    search_id: string;
    standing: string;
    match_id: string | null;
  }>`
    SELECT search_id, standing, match_id FROM chess_opponent_searches WHERE owner_id = ${owner} AND deleted_at IS NULL`);
  return { game: games[0] ?? null, search: searches[0] ?? null };
}

/** One observed moment across devices, without a report frame per SQL read. */
export async function multiplayerDeviceViews(
  s: ProductHarness,
  actors: readonly string[]
) {
  const views = new Map<string, Awaited<ReturnType<typeof multiplayerView>>>();
  for (const actor of actors) views.set(actor, await multiplayerView(s, actor));
  return views;
}

export async function multiplayerText(
  s: ProductHarness,
  actor: string,
  target: string
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  return (await ui.get(target).isVisible())
    ? await ui.get(target).text()
    : null;
}

export async function storedMultiplayerGames(
  s: ProductHarness
): Promise<readonly MultiplayerGame[]> {
  return s.harness.serverSql.sqlClient.query(sql<MultiplayerGame>`
    SELECT id, white_id, black_id, fen, pgn, revision, turn, outcome, reason FROM chess_multiplayer_games ORDER BY id`);
}

export async function storedMultiplayerSnapshot(s: ProductHarness) {
  return s.harness.serverSql.sqlClient.transaction(async (tx) => ({
    games: await tx.query(sql<MultiplayerGame & { match_id: string }>`
      SELECT id, match_id, white_id, black_id, fen, pgn, revision, turn, outcome, reason
      FROM chess_multiplayer_games WHERE deleted_at IS NULL ORDER BY id`),
    current: await tx.query(sql<{ owner_id: string; game_id: string }>`
      SELECT owner_id, game_id FROM chess_multiplayer_players
      WHERE deleted_at IS NULL AND owner_id IS NOT NULL AND game_id IS NOT NULL ORDER BY owner_id`),
  }));
}

export async function multiplayerRating(s: ProductHarness, actor: string) {
  const owner = await accountIdOf(s, actor);
  if (owner === null) throw new Error('Missing multiplayer account');
  const current = await readCurrent(
    s.harness.serverSql.sqlClient,
    owner,
    s.harness.clock.now()
  );
  return current?.result?.data[asKeyword('player/rating')] ?? null;
}

import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from '@libs/auth/public/auth-storage-keys';
