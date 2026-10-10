import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import { MULTIPLAYER_GAME_COLUMNS } from '@libs/chess-matchmaking-shared/game-state';
import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { actorLocalSql, signedInAccountOf } from '@libs/harness/identity';
import { bringToFront } from '@libs/harness/observations';
import sql, { raw } from '@pkgs/sql-root-shared/sql';

export type MultiplayerSearchView = {
  readonly search_id: string;
  readonly standing: string;
  readonly match_id: string | null;
  readonly time_control: string | null;
  readonly joined_at_ms: number | null;
};

export type MultiplayerRatingView = {
  readonly speed: string;
  readonly rating: number;
  readonly games: number;
};

const GAME_COLUMNS = raw(
  MULTIPLAYER_GAME_COLUMNS.map((column) => `g.${column}`).join(', ')
);

const NOTHING = { game: null, search: null, ratings: [] } as const;

/** What one device holds: the person's current game, search and own ratings. */
export async function multiplayerView(
  s: ProductHarness,
  actor: string
): Promise<{
  readonly game: MultiplayerGame | null;
  readonly search: MultiplayerSearchView | null;
  readonly ratings: readonly MultiplayerRatingView[];
}> {
  const db = actorLocalSql(s, actor);
  const owner = await signedInAccountOf(s, actor);
  if (db === null || owner === null) return NOTHING;
  const games = await db.query(sql<MultiplayerGame>`SELECT ${GAME_COLUMNS}
    FROM chess_multiplayer_games AS g
    JOIN chess_multiplayer_players AS p ON p.game_id = g.id
    WHERE p.owner_id = ${owner} AND p.deleted_at IS NULL AND g.deleted_at IS NULL
      AND (g.white_id = ${owner} OR g.black_id = ${owner})`);
  const searches = await db.query(sql<MultiplayerSearchView>`
    SELECT search_id, standing, match_id, time_control, joined_at_ms FROM chess_opponent_searches
    WHERE owner_id = ${owner} AND deleted_at IS NULL`);
  const ratings = await db.query(sql<MultiplayerRatingView>`
    SELECT speed, rating, games FROM chess_multiplayer_ratings
    WHERE owner_id = ${owner} AND deleted_at IS NULL ORDER BY speed`);
  return { game: games[0] ?? null, search: searches[0] ?? null, ratings };
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

/** The text a person sees on their multiplayer screen, brought to the front. */
export async function shownMultiplayerText(
  s: ProductHarness,
  actor: string,
  target: string
): Promise<string | null> {
  await bringToFront(s, actor);
  return multiplayerText(s, actor, target);
}

/** Seconds shown on one rendered multiplayer clock (`m:ss`). */
export async function shownMultiplayerClock(
  s: ProductHarness,
  actor: string,
  side: 'white' | 'black'
): Promise<number | null> {
  const text = await shownMultiplayerText(
    s,
    actor,
    `multiplayer-${side}-clock`
  );
  const parts = /^(\d+):(\d{2})$/.exec(text?.trim() ?? '');
  if (parts === null) return null;
  return Number(parts[1]) * 60 + Number(parts[2]);
}

export async function storedMultiplayerSnapshot(s: ProductHarness) {
  return s.harness.serverSql.sqlClient.transaction(async (tx) => ({
    games: await tx.query(sql<
      MultiplayerGame & { match_id: string }
    >`SELECT g.match_id, ${GAME_COLUMNS}
      FROM chess_multiplayer_games AS g WHERE g.deleted_at IS NULL ORDER BY g.id`),
    current: await tx.query(sql<{ owner_id: string; game_id: string }>`
      SELECT owner_id, game_id FROM chess_multiplayer_players
      WHERE deleted_at IS NULL AND owner_id IS NOT NULL AND game_id IS NOT NULL ORDER BY owner_id`),
  }));
}
